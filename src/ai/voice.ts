import "server-only";
import { errorCode, getOpenAI, isAIConfigured, type AIUsage } from "./openai";

/**
 * Voice pipeline (Phase 7): audio → transcription → the same LÍA
 * orchestrator → optional spoken reply. Models come from env; realtime
 * conversation (OPENAI_MODEL_VOICE) can replace this without touching the agent.
 */
export function transcribeModel(): string {
  return process.env.OPENAI_MODEL_TRANSCRIBE || "gpt-4o-mini-transcribe";
}

export function ttsModel(): string {
  return process.env.OPENAI_MODEL_TTS || "gpt-4o-mini-tts";
}

export function isVoiceConfigured(): boolean {
  return isAIConfigured();
}

export async function transcribe(file: File, onUsage?: (u: AIUsage) => Promise<void> | void): Promise<string> {
  const model = transcribeModel();
  const started = Date.now();
  try {
    const res = await getOpenAI().audio.transcriptions.create({ file, model, language: "es", prompt: "Conversación con LÍA, asistente personal. Nombres propios, fechas y montos en pesos colombianos." });
    await onUsage?.({ purpose: "voice_transcribe", model, latencyMs: Date.now() - started, success: true });
    return res.text.trim();
  } catch (err) {
    await onUsage?.({ purpose: "voice_transcribe", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
    throw err;
  }
}

export async function speak(text: string, onUsage?: (u: AIUsage) => Promise<void> | void): Promise<ArrayBuffer> {
  const model = ttsModel();
  const started = Date.now();
  try {
    const res = await getOpenAI().audio.speech.create({
      model,
      voice: "marin",
      input: text.slice(0, 1500),
      response_format: "mp3",
      instructions: "Habla en español latinoamericano, tono sereno, cercano y ejecutivo. Ritmo tranquilo, sin exagerar emociones.",
    });
    const audio = await res.arrayBuffer();
    await onUsage?.({ purpose: "voice_tts", model, latencyMs: Date.now() - started, success: true });
    return audio;
  } catch (err) {
    await onUsage?.({ purpose: "voice_tts", model, latencyMs: Date.now() - started, success: false, errorCode: errorCode(err) });
    throw err;
  }
}

/** Strips list markers and times formatting so TTS reads naturally. */
export function speakableText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^\s*[•-]\s*/gm, "")
    .replace(/(\d{2}):(\d{2})–(\d{2}):(\d{2})/g, "de $1:$2 a $3:$4")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}
