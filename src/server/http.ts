import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { UserFacingError } from "@/application/context";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getDb } from "@/server/db/client";
import { validateSession } from "./auth/service";
import { SESSION_COOKIE } from "./auth/session";

export type ApiUser = { userId: string };

/** Route-handler guard: session + same-origin check for mutations (CSRF) + rate limit. */
export async function guardApi(req: NextRequest, opts: { limit?: number; windowMs?: number; bucket?: string } = {}): Promise<ApiUser | NextResponse> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }
  }
  const session = await validateSession(getDb(), req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  const rl = rateLimit(`${opts.bucket ?? "api"}:${session.userId}`, opts.limit ?? 120, opts.windowMs ?? 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Vas muy rápido. Espera unos segundos e intenta de nuevo." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  return { userId: session.userId };
}

export function apiError(err: unknown, event: string): NextResponse {
  if (err instanceof UserFacingError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "CONFLICT" ? 409 : err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  log.error(event, { err });
  return NextResponse.json({ error: "No pude completar la operación. Tu información sigue intacta. Intenta nuevamente." }, { status: 500 });
}
