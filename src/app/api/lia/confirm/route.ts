import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolvePendingAction } from "@/ai/orchestrator";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

const Body = z.object({ messageId: z.string().uuid(), decision: z.enum(["confirm", "reject"]), args: z.record(z.string(), z.unknown()).optional() });

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "confirm", limit: 60 });
  if (guard instanceof NextResponse) return guard;
  try {
    const body = Body.parse(await req.json());
    const result = await resolvePendingAction(getDb(), guard.userId, body.messageId, body.decision, body.args);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, "api.confirm");
  }
}
