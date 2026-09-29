"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Item = { id: string; filename: string; sizeBytes: number };

export async function uploadFile(file: File, link?: { entityType: string; entityId: string }): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("file", file);
  if (link) {
    form.set("entityType", link.entityType);
    form.set("entityId", link.entityId);
  }
  const res = await fetch("/api/attachments", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { filename?: string; error?: string };
  return res.ok ? { ok: true, filename: data.filename ?? file.name } : { ok: false, error: data.error ?? "No pude subir el archivo." };
}

export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.txt,.doc,.docx,.xlsx";

export function AttachmentsPanel({ entityType, entityId, items }: { entityType: string; entityId: string; items: Item[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const r = await uploadFile(file, { entityType, entityId });
    setBusy(false);
    if (input.current) input.current.value = "";
    toast.show(r.ok ? { message: `Adjuntado: ${r.filename}` } : { message: r.error, tone: "error" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    toast.show(res.ok ? { message: "Archivo eliminado.", tone: "info" } : { message: "No pude eliminarlo.", tone: "error" });
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-ink-3" />
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-[14px] hover:underline">{a.filename}</a>
              <span className="text-[12px] tabular-nums text-ink-3">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
              <button onClick={() => void remove(a.id)} aria-label={`Eliminar ${a.filename}`} className="text-ink-3 hover:text-bad"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[12.5px] text-ink-3">PDF, imágenes, Word, Excel · máx. 5 MB</p>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void onPick(e.target.files?.[0])} aria-label="Adjuntar archivo" />
        <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          {!busy ? <Paperclip className="h-3.5 w-3.5" /> : null} Adjuntar
        </Button>
      </div>
    </div>
  );
}
