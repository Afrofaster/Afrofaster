import { NextResponse, type NextRequest } from "next/server";
import { handleChatMessage, type ChatEvent } from "@/ai/orchestrator";
import { UserFacingError } from "@/application/context";
import { log } from "@/lib/logger";
import { guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

export const maxDuration = 60;

/**
 * Streams NDJSON events so the UI can show "pensando / organizando /
 * guardando" while LÍA works, then the final message.
 */
export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "chat", limit: 30 });
  if (guard instanceof NextResponse) return guard;
  const body = (await req.json().catch(() => null)) as { text?: unknown; conversationId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  if (!text.trim()) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent | { type: "error"; error: string }) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        await handleChatMessage(getDb(), guard.userId, { text, conversationId }, send);
      } catch (err) {
        if (!(err instanceof UserFacingError)) log.error("api.chat", { err });
        send({ type: "error", error: err instanceof UserFacingError ? err.message : "No pude responder ahora. Tu mensaje quedó guardado; intenta de nuevo." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
