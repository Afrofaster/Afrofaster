"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Server voice: records with MediaRecorder, transcribes on the server and can
 * speak replies. The OpenAI key never reaches the browser.
 */
export function useServerVoice() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);

  const start = useCallback(async (onText: (text: string) => void, onError: (msg: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.set("audio", new File([blob], `voz.${blob.type.includes("mp4") ? "mp4" : "webm"}`, { type: blob.type }));
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
          if (!res.ok || !data.text) onError(data.error ?? "No entendí el audio. Intenta de nuevo.");
          else onText(data.text);
        } finally {
          setTranscribing(false);
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      onError("No tengo acceso al micrófono. Revisa los permisos del navegador.");
    }
  }, []);

  const stop = useCallback(() => recorder.current?.state === "recording" && recorder.current.stop(), []);

  const speak = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      audio.current?.pause();
      audio.current = new Audio(url);
      audio.current.onended = () => URL.revokeObjectURL(url);
      await audio.current.play();
    } catch {
      // Speaking is a bonus; the text reply is already on screen.
    }
  }, []);

  const silence = useCallback(() => audio.current?.pause(), []);

  return { recording, transcribing, start, stop, speak, silence };
}
