import { NextResponse, type NextRequest } from "next/server";
import { UserFacingError } from "@/application/context";
import { recordAIUsage } from "@/ai/openai";
import { isVoiceConfigured, transcribe } from "@/ai/voice";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "voice", limit: 30 });
  if (guard instanceof NextResponse) return guard;
  try {
    if (!isVoiceConfigured()) throw new UserFacingError("La voz con IA no está configurada. Usa el dictado del navegador.");
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) throw new UserFacingError("No recibí audio.");
    if (audio.size > MAX_AUDIO_BYTES) throw new UserFacingError("El audio es demasiado largo.");
    const db = getDb();
    const text = await transcribe(audio, (u) => recordAIUsage(db, guard.userId, u));
    return NextResponse.json({ text });
  } catch (err) {
    return apiError(err, "api.voice.transcribe");
  }
}
