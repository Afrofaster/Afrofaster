import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/server/db/client";
import { validateSession, type SessionInfo } from "./service";

export const SESSION_COOKIE = "lia_session";

function secureCookies(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Per-request memoized session lookup. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(getDb(), token);
});

/** For pages and Server Actions. Redirects to /login when there is no session. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.userId;
}

export async function currentUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
