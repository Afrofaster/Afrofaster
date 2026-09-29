import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { initializeWorkspace } from "@/application/workspace";
import { runAsUser } from "@/application/context";
import { withAuthContext, type Db } from "@/server/db/factory";
import { sessions, users } from "@/server/db/schema";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "./password";

export const SESSION_TTL_DAYS = 60;
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

export const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un email válido").max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`).max(200),
});

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function countUsers(db: Db): Promise<number> {
  return withAuthContext(db, async (tx) => {
    const [row] = await tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users);
    return row.n;
  });
}

export class AuthError extends Error {}

export async function registerUser(db: Db, input: { email: string; password: string; displayName?: string }): Promise<{ id: string }> {
  const { email, password } = CredentialsSchema.parse(input);
  const passwordHash = await hashPassword(password);
  const user = await withAuthContext(db, async (tx) => {
    const existing = await tx.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
    if (existing) throw new AuthError("Ya existe una cuenta con ese email.");
    const [row] = await tx.insert(users).values({ email, passwordHash }).returning({ id: users.id });
    return row;
  });
  await runAsUser(db, user.id, (ctx) => initializeWorkspace(ctx, input.displayName?.trim() || "Jhony"));
  return user;
}

/** Returns the user id or null. Always spends the same hashing time to avoid user enumeration. */
export async function authenticate(db: Db, email: string, password: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const user = await withAuthContext(db, (tx) => tx.query.users.findFirst({ where: and(sql`lower(${users.email}) = ${normalized}`, sql`${users.deletedAt} is null`) }));
  const hash = user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";
  const ok = await verifyPassword(password, hash);
  return ok && user ? user.id : null;
}

export async function createSession(db: Db, userId: string, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await withAuthContext(db, (tx) => tx.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 300) ?? null }));
  return { token, expiresAt };
}

export type SessionInfo = { userId: string; sessionId: string; expiresAt: Date; refreshed: boolean };

export async function validateSession(db: Db, token: string | undefined | null): Promise<SessionInfo | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  return withAuthContext(db, async (tx) => {
    const row = await tx.query.sessions.findFirst({ where: and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())) });
    if (!row) return null;
    const user = await tx.query.users.findFirst({ where: and(eq(users.id, row.userId), sql`${users.deletedAt} is null`), columns: { id: true } });
    if (!user) return null;
    let expiresAt = row.expiresAt;
    let refreshed = false;
    if (Date.now() - row.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
      expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
      await tx.update(sessions).set({ lastSeenAt: new Date(), expiresAt }).where(eq(sessions.id, row.id));
      refreshed = true;
    }
    return { userId: row.userId, sessionId: row.id, expiresAt, refreshed };
  });
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await withAuthContext(db, (tx) => tx.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))));
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await withAuthContext(db, (tx) => tx.delete(sessions).where(eq(sessions.userId, userId)));
}

/** Hard delete of the account and (by cascade) every row the user owns. */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await withAuthContext(db, (tx) => tx.delete(users).where(eq(users.id, userId)));
}

export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  const user = await withAuthContext(db, (tx) => tx.query.users.findFirst({ where: eq(users.id, userId) }));
  if (!user?.passwordHash || !(await verifyPassword(current, user.passwordHash))) throw new AuthError("La contraseña actual no es correcta.");
  const parsed = CredentialsSchema.shape.password.parse(next);
  const passwordHash = await hashPassword(parsed);
  await withAuthContext(db, (tx) => tx.update(users).set({ passwordHash }).where(eq(users.id, userId)));
}
