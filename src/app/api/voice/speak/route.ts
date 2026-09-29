import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UserFacingError } from "@/application/context";
import { recordAIUsage } from "@/ai/openai";
import { isVoiceConfigured, speak, speakableText } from "@/ai/voice";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

const Body = z.object({ text: z.string().trim().min(1).max(4000) });

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "voice", limit: 30 });
  if (guard instanceof NextResponse) return guard;
  try {
    if (!isVoiceConfigured()) throw new UserFacingError("La voz con IA no está configurada.");
    const { text } = Body.parse(await req.json());
    const db = getDb();
    const audio = await speak(speakableText(text), (u) => recordAIUsage(db, guard.userId, u));
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError(err, "api.voice.speak");
  }
}
