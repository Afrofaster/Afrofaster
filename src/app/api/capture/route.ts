import { NextResponse, type NextRequest } from "next/server";
import { capture } from "@/application/capture";
import { classifyIntent } from "@/ai/intent/router";
import { recordAIUsage } from "@/ai/openai";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "capture", limit: 60 });
  if (guard instanceof NextResponse) return guard;
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; clientId?: unknown; source?: unknown } | null;
    const db = getDb();
    const result = await capture(
      db,
      guard.userId,
      { text: typeof body?.text === "string" ? body.text : "", clientId: typeof body?.clientId === "string" ? body.clientId : null, source: body?.source === "OFFLINE_SYNC" ? "OFFLINE_SYNC" : "QUICK_CAPTURE" },
      (text, ctx) => classifyIntent(text, { ...ctx, onUsage: (u) => recordAIUsage(db, guard.userId, u) }),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return apiError(err, "api.capture");
  }
}
