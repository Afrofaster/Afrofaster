"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { AuthError, authenticate, countUsers, createSession, CredentialsSchema, registerUser, revokeSession } from "@/server/auth/service";
import { clearSessionCookie, currentUserAgent, SESSION_COOKIE, setSessionCookie } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { cookies } from "next/headers";

export type AuthState = { error: string | null; email?: string };

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const rl = rateLimit(`login:${await clientKey()}`, 8, 10 * 60_000);
  if (!rl.ok) return { error: "Demasiados intentos. Espera unos minutos.", email };
  if (!email || !password) return { error: "Escribe tu email y contraseña.", email };
  let userId: string | null;
  try {
    userId = await authenticate(getDb(), email, password);
  } catch (err) {
    log.error("auth.login_failed", { err });
    return { error: "No pude iniciar sesión ahora. Intenta de nuevo en un momento.", email };
  }
  if (!userId) return { error: "Email o contraseña incorrectos.", email };
  const session = await createSession(getDb(), userId, await currentUserAgent());
  await setSessionCookie(session.token, session.expiresAt);
  redirect(safeNext(form.get("next")));
}

export async function signupAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const rl = rateLimit(`signup:${await clientKey()}`, 5, 60 * 60_000);
  if (!rl.ok) return { error: "Demasiados intentos. Espera un rato.", email };
  const allowed = process.env.ALLOW_SIGNUP === "true" || (await countUsers(getDb())) === 0;
  if (!allowed) return { error: "El registro está cerrado en esta instalación.", email };
  try {
    const creds = CredentialsSchema.parse({ email, password: form.get("password") });
    const user = await registerUser(getDb(), { ...creds, displayName: String(form.get("name") ?? "").trim() || undefined });
    const session = await createSession(getDb(), user.id, await currentUserAgent());
    await setSessionCookie(session.token, session.expiresAt);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message, email };
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Datos inválidos.", email };
    log.error("auth.signup_failed", { err });
    return { error: "No pude crear la cuenta. Intenta nuevamente.", email };
  }
  redirect("/onboarding");
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(getDb(), token);
  await clearSessionCookie();
  redirect("/login");
}
