import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectGoogleCalendar, syncCalendar } from "@/application/calendar";
import { runAsUser } from "@/application/context";
import { log } from "@/lib/logger";
import { guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

const STATE_COOKIE = "lia_oauth_state";

function sameState(a: string | undefined, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "oauth", limit: 10 });
  if (guard instanceof NextResponse) return guard;
  const to = (status: string) => {
    const res = NextResponse.redirect(new URL(`/settings?calendar=${status}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/calendar" });
    return res;
  };
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return to("denied");
  if (!sameState(req.cookies.get(STATE_COOKIE)?.value, params.get("state"))) return to("invalid_state");
  const code = params.get("code");
  if (!code) return to("error");
  try {
    await runAsUser(getDb(), guard.userId, (ctx) => connectGoogleCalendar(ctx, code));
    await runAsUser(getDb(), guard.userId, (ctx) => syncCalendar(ctx)).catch((err) => log.warn("calendar.first_sync_failed", { err }));
    return to("connected");
  } catch (err) {
    log.error("calendar.connect_failed", { err });
    return to("error");
  }
}
