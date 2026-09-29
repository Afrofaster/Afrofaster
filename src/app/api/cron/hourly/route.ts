import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runHourlyJobs } from "@/application/jobs";
import { isGoogleCalendarConfigured } from "@/integrations/calendar";
import { isPushConfigured, sendPush } from "@/integrations/push";
import { log } from "@/lib/logger";
import { getDb } from "@/server/db/client";

export const maxDuration = 300;

/**
 * Called hourly by the scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * Never public: without CRON_SECRET configured it refuses to run.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (!secret || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const summary = await runHourlyJobs(getDb(), { sendPush: isPushConfigured() ? sendPush : undefined, syncCalendars: isGoogleCalendarConfigured() });
  log.info("job.hourly", summary);
  return NextResponse.json(summary);
}
