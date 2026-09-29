import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { googleAuthUrl, isGoogleCalendarConfigured } from "@/integrations/calendar";
import { isEncryptionConfigured } from "@/lib/crypto";
import { guardApi } from "@/server/http";

const OAUTH_STATE_COOKIE = "lia_oauth_state";

/** Starts the Google OAuth flow (read-only calendar scope) with a CSRF state cookie. */
export async function GET(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "oauth", limit: 10 });
  if (guard instanceof NextResponse) return guard;
  if (!isGoogleCalendarConfigured() || !isEncryptionConfigured()) {
    return NextResponse.redirect(new URL("/settings?calendar=not_configured", req.url));
  }
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: (process.env.APP_URL ?? "").startsWith("https://"), path: "/api/calendar", maxAge: 600 });
  return res;
}
