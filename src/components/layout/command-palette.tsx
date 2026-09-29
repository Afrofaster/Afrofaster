"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck2, ClipboardCheck, FolderPlus, ListPlus, MessageCircle, PenLine, Search, Sun, Target } from "lucide-react";

type Hit = { type: string; id: string; title: string; subtitle: string | null; href: string };

export function CommandPalette({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (open: boolean) => void; onCapture: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: Hit[] }) => setHits(d.hits))
        .catch(() => undefined);
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  const visibleHits = query.trim().length >= 2 ? hits : [];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Paleta de comandos"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]"
      contentClassName="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lg)] animate-fade-up"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="h-4 w-4 text-ink-3" />
        <Command.Input value={query} onValueChange={setQuery} placeholder="Buscar tareas, proyectos, personas… o ejecutar" className="h-14 flex-1 bg-transparent text-[15px] outline-none" />
      </div>
      <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-6 text-center text-sm text-ink-3">Sin resultados.</Command.Empty>
        {visibleHits.length > 0 ? (
          <Command.Group heading="Resultados" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
            {visibleHits.map((h) => (
              <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className={itemClass}>
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="text-xs text-ink-3">{h.subtitle}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        <Command.Group heading="Acciones" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          <Command.Item value="capturar" onSelect={() => { onOpenChange(false); onCapture(); }} className={itemClass}><PenLine className="h-4 w-4" /> Capturar</Command.Item>
          <Command.Item value="nueva tarea" onSelect={() => go("/tasks?new=1")} className={itemClass}><ListPlus className="h-4 w-4" /> Nueva tarea</Command.Item>
          <Command.Item value="nuevo proyecto" onSelect={() => go("/projects?new=1")} className={itemClass}><FolderPlus className="h-4 w-4" /> Nuevo proyecto</Command.Item>
          <Command.Item value="nuevo objetivo" onSelect={() => go("/goals?new=1")} className={itemClass}><Target className="h-4 w-4" /> Nuevo objetivo</Command.Item>
          <Command.Item value="planear hoy" onSelect={() => go("/lia?q=organ%C3%ADzame%20hoy")} className={itemClass}><CalendarCheck2 className="h-4 w-4" /> Planear hoy</Command.Item>
          <Command.Item value="daily brief" onSelect={() => go("/brief")} className={itemClass}><Sun className="h-4 w-4" /> Daily Brief</Command.Item>
          <Command.Item value="revision semanal" onSelect={() => go("/reviews/weekly")} className={itemClass}><ClipboardCheck className="h-4 w-4" /> Revisión semanal</Command.Item>
          <Command.Item value="hablar con lia" onSelect={() => go("/lia")} className={itemClass}><MessageCircle className="h-4 w-4" /> Hablar con LÍA</Command.Item>
          {query.trim().length >= 2 ? (
            <Command.Item value="buscar todo" onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)} className={itemClass}><Search className="h-4 w-4" /> Buscar “{query}”</Command.Item>
          ) : null}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

const itemClass = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink";
