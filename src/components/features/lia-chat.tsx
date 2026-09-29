"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Mic, MicOff, Paperclip, Pencil, X, Zap } from "lucide-react";
import type { ChatMessageDTO } from "@/ai/orchestrator";
import type { MessageCard, PendingAction } from "@/server/db/schema";
import { LiaOrb } from "@/components/layout/lia-orb";
import { useToast } from "@/components/ui/toast";
import { useCapture } from "./quick-capture";
import { cn } from "@/lib/cn";

const STARTERS = ["Organízame mañana", "¿Cómo vamos?", "¿Qué tengo pendiente?", "Estoy saturado", "Hagamos la revisión semanal"];

type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function LiaChat({ initialMessages, initialConversationId, initialQuery, displayName }: { initialMessages: ChatMessageDTO[]; initialConversationId: string | null; initialQuery?: string; displayName: string }) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sentInitial = useRef(false);
  const toast = useToast();
  const router = useRouter();
  const capture = useCapture();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || status) return;
      setText("");
      const optimistic: ChatMessageDTO = { id: `local-${Date.now()}`, role: "USER", content: value, cards: [], pendingAction: null, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, optimistic]);
      setStatus("Pensando…");
      try {
        const res = await fetch("/api/lia/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, conversationId }) });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "No pude responder.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { type: string; label?: string; message?: ChatMessageDTO; conversationId?: string; error?: string };
            if (event.type === "status" && event.label) setStatus(event.label);
            if (event.type === "message" && event.message) {
              setMessages((m) => [...m, event.message!]);
              if (event.conversationId) setConversationId(event.conversationId);
            }
            if (event.type === "error") throw new Error(event.error);
          }
        }
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "No pude responder.";
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "ASSISTANT", content: navigator.onLine ? message : "Estás sin conexión. Si quieres, usa ⚡ Captura: se guarda aquí y se sincroniza al volver.", cards: [], pendingAction: null, createdAt: new Date().toISOString() }]);
      } finally {
        setStatus(null);
        inputRef.current?.focus();
      }
    },
    [conversationId, status, router],
  );

  useEffect(() => {
    if (initialQuery && !sentInitial.current) {
      sentInitial.current = true;
      router.replace("/lia");
      void send(initialQuery);
    }
  }, [initialQuery, send, router]);

  async function submit() {
    const value = text.trim();
    if (!value) return;
    if (captureMode) {
      setText("");
      await capture.submit(value);
      return;
    }
    await send(value);
  }

  function toggleDictation() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      toast.show({ message: "Tu navegador no permite dictado. La voz completa con LÍA llega en una próxima fase.", tone: "info" });
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "es-CO";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ");
      setText((t) => `${t ? `${t} ` : ""}${transcript}`.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function resolve(messageId: string, decision: "confirm" | "reject", args?: Record<string, unknown>) {
    setStatus(decision === "confirm" ? "Guardando…" : null);
    try {
      const res = await fetch("/api/lia/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, decision, args }) });
      const data = (await res.json()) as { message?: ChatMessageDTO; status?: PendingAction["status"]; error?: string };
      if (!res.ok || !data.message || !data.status) throw new Error(data.error ?? "No pude hacerlo.");
      const newStatus = data.status;
      setMessages((m) => [...m.map((x) => (x.id === messageId && x.pendingAction ? { ...x, pendingAction: { ...x.pendingAction, status: newStatus } } : x)), data.message!]);
      router.refresh();
    } catch (err) {
      toast.show({ message: err instanceof Error ? err.message : "No pude hacerlo.", tone: "error" });
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex-1 space-y-5 pb-44 lg:pb-32">
        {messages.length === 0 && !status ? (
          <div className="flex flex-col items-center pt-10 text-center animate-fade-up">
            <LiaOrb size={72} />
            <h1 className="display mt-6 text-3xl">Hola, {displayName}.</h1>
            <p className="mt-2 max-w-xs text-[15px] text-ink-2">Cuéntame qué pasó, qué tienes en mente o qué necesitas decidir. Yo lo organizo.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => void send(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px] text-ink-2 shadow-sm transition-colors hover:border-line-strong hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onSend={(t) => void send(t)} onResolve={resolve} busy={Boolean(status)} />
        ))}

        {status ? (
          <div className="flex items-center gap-3 animate-fade-up" role="status" aria-live="polite">
            <LiaOrb size={30} thinking />
            <span className="text-[14px] text-ink-3">{status}</span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-6 lg:left-64">
        <div className="mx-auto max-w-2xl lg:max-w-3xl lg:px-8">
          <div className={cn("glass rounded-[26px] border shadow-[var(--shadow-lg)] transition-colors", captureMode ? "border-accent" : "border-line")}>
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={captureMode ? "Captura rápida: se guarda y se organiza…" : "Escríbele a LÍA…"}
              aria-label="Mensaje para LÍA"
              maxLength={4000}
              className="block max-h-44 min-h-12 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15.5px] leading-snug outline-none"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <ToolbarButton label={listening ? "Detener dictado" : "Voz"} active={listening} onClick={toggleDictation}>
                {listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
              </ToolbarButton>
              <ToolbarButton label="Adjuntar" onClick={() => toast.show({ message: "Adjuntar documentos llega pronto: la arquitectura ya está lista.", tone: "info" })}>
                <Paperclip className="h-[18px] w-[18px]" />
              </ToolbarButton>
              <ToolbarButton label="Captura rápida" active={captureMode} onClick={() => setCaptureMode((v) => !v)}>
                <Zap className="h-[18px] w-[18px]" />
                <span className="text-[12px] font-medium">{captureMode ? "Captura" : ""}</span>
              </ToolbarButton>
              <button onClick={() => void submit()} disabled={!text.trim() || Boolean(status)} className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25" aria-label="Enviar">
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} title={label} className={cn("flex h-9 items-center gap-1 rounded-full px-2.5 transition-colors", active ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}>
      {children}
    </button>
  );
}

function MessageBubble({ message, onSend, onResolve, busy }: { message: ChatMessageDTO; onSend: (t: string) => void; onResolve: (id: string, d: "confirm" | "reject", args?: Record<string, unknown>) => void; busy: boolean }) {
  if (message.role === "USER") {
    return (
      <div className="flex justify-end animate-fade-up">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-snug text-bg">{message.content}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-3 animate-fade-up">
      <LiaOrb size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-3">
        <RichText text={message.content} />
        {message.cards.map((c, i) => (
          <CardView key={i} card={c} onSend={onSend} />
        ))}
        {message.pendingAction ? <PendingCard messageId={message.id} action={message.pendingAction} onResolve={onResolve} busy={busy} /> : null}
      </div>
    </div>
  );
}

/** Minimal formatting: paragraphs, bullets and **bold**. No HTML injection. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-ink">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        return (
          <p key={i} className="whitespace-pre-wrap">
            {lines.map((line, j) => (
              <span key={j} className={cn("block", /^\s*(•|-|\d+\.)\s/.test(line) && "pl-1", /^\d{2}:\d{2}/.test(line) && "font-mono text-[13.5px]")}>
                {line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => (seg.startsWith("**") && seg.endsWith("**") ? <strong key={k}>{seg.slice(2, -2)}</strong> : seg))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function PendingCard({ messageId, action, onResolve, busy }: { messageId: string; action: PendingAction; onResolve: (id: string, d: "confirm" | "reject", args?: Record<string, unknown>) => void; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const editableTitle = typeof action.args.title === "string" ? (action.args.title as string) : typeof action.args.text === "string" ? (action.args.text as string) : null;
  const titleKey = typeof action.args.title === "string" ? "title" : "text";
  const [draft, setDraft] = useState(editableTitle ?? "");

  if (action.status !== "PENDING") {
    const label = { CONFIRMED: "Confirmado", REJECTED: "Cancelado", FAILED: "No se pudo completar", PENDING: "" }[action.status];
    return (
      <p className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px]", action.status === "CONFIRMED" ? "bg-good-soft text-good" : "bg-surface-2 text-ink-3")}>
        {action.status === "CONFIRMED" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {label}: {action.summary}
      </p>
    );
  }
  return (
    <div className="card overflow-hidden border-accent/30 shadow-[var(--shadow)]">
      <div className="px-4 pt-3.5 pb-3">
        <p className="eyebrow text-accent">Requiere tu confirmación</p>
        {editing && editableTitle !== null ? (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-accent" aria-label="Editar" />
        ) : (
          <p className="mt-1 text-[15px] font-medium leading-snug">{action.summary}</p>
        )}
      </div>
      <div className="flex border-t border-line">
        <button disabled={busy} onClick={() => onResolve(messageId, "confirm", editing && editableTitle !== null ? { [titleKey]: draft } : undefined)} className="flex flex-1 items-center justify-center gap-1.5 py-3 text-[14px] font-medium text-accent hover:bg-accent-soft disabled:opacity-50">
          <Check className="h-4 w-4" /> Confirmar
        </button>
        {editableTitle !== null && !editing ? (
          <button disabled={busy} onClick={() => setEditing(true)} className="flex flex-1 items-center justify-center gap-1.5 border-l border-line py-3 text-[14px] text-ink-2 hover:bg-surface-2">
            <Pencil className="h-4 w-4" /> Editar
          </button>
        ) : null}
        <button disabled={busy} onClick={() => onResolve(messageId, "reject")} className="flex flex-1 items-center justify-center gap-1.5 border-l border-line py-3 text-[14px] text-ink-3 hover:bg-surface-2">
          Cancelar
        </button>
      </div>
    </div>
  );
}

type PlanBlockData = { start: string; end: string; title: string; kind: string };

function CardView({ card, onSend }: { card: MessageCard; onSend: (t: string) => void }) {
  const d = card.data;
  switch (card.kind) {
    case "plan": {
      const blocks = (d.blocks as PlanBlockData[]) ?? [];
      const util = Math.round(((d.utilization as number) ?? 0) * 100);
      return (
        <div className="card p-4">
          <div className="mb-3">
            <p className="eyebrow">Plan propuesto</p>
            <p className="mt-0.5 text-[12px] text-ink-3">Usa {util}% de tu tiempo libre · {Math.round((((d.marginMinutes as number) ?? 0) / 60) * 10) / 10} h de margen</p>
          </div>
          <ol className="relative space-y-2 border-l border-line pl-4">
            {blocks.map((b, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface", b.kind === "DEEP_WORK" ? "bg-accent" : b.kind === "EVENT" ? "bg-warn" : b.kind === "COMMITMENT" ? "bg-ink-3" : b.kind === "TRAINING" ? "bg-good" : "bg-line-strong")} />
                <p className="font-mono text-[12px] text-ink-3">{b.start}–{b.end}</p>
                <p className="text-[14px]">{b.title}{b.kind === "DEEP_WORK" ? <span className="ml-1.5 text-[11px] font-medium text-accent">Deep work</span> : null}</p>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "capacity": {
      const level = d.level as string;
      const tone = level === "NORMAL" ? "text-good bg-good-soft" : level === "HIGH" ? "text-warn bg-warn-soft" : "text-bad bg-bad-soft";
      return (
        <div className="card flex items-center gap-3 p-4">
          <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", tone)}>{level}</span>
          <span className="text-[13.5px] text-ink-2">Uso {Math.round(((d.utilization as number) ?? 0) * 100)}% de tu capacidad real</span>
          <Link href="/today" className="ml-auto text-[13px] font-medium text-accent">Ajustar</Link>
        </div>
      );
    }
    case "status":
      return (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Life Score" value={d.lifeScore === null ? "—" : String(d.lifeScore)} />
          <MiniStat label="Cerradas" value={String(d.completed ?? 0)} />
          <MiniStat label="Capacidad" value={String(d.capacity ?? "—").toLowerCase()} />
        </div>
      );
    case "loops": {
      const c = d.counts as Record<string, number>;
      return (
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Abiertas" value={String(c.open)} />
          <MiniStat label="Vencidas" value={String(c.overdue)} />
          <MiniStat label="Espera" value={String(c.waiting)} />
          <MiniStat label="Decidir" value={String(c.decisions)} />
        </div>
      );
    }
    case "suggestions":
      return (
        <div className="flex flex-wrap gap-2">
          {((d.items as string[]) ?? []).map((s) => (
            <button key={s} onClick={() => onSend(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink">{s}</button>
          ))}
        </div>
      );
    case "link":
    case "entity":
      return (
        <Link href={String(d.href ?? "/")} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-accent shadow-sm hover:border-line-strong">
          {String(d.label ?? d.title ?? "Ver")} →
        </Link>
      );
    default:
      return null;
  }
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-2.5">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p className="display mt-0.5 text-lg capitalize">{value}</p>
    </div>
  );
}
