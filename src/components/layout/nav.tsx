"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, Compass, House, LayoutGrid, Search, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { LiaOrb } from "./lia-orb";

const ITEMS = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/today", label: "Hoy", icon: CalendarCheck2 },
  { href: "/lia", label: "LÍA", icon: null },
  { href: "/life", label: "Vida", icon: Compass },
  { href: "/more", label: "Más", icon: LayoutGrid },
] as const;

const MORE_PATHS = ["/more", "/goals", "/projects", "/inbox", "/reviews", "/decisions", "/metrics", "/people", "/settings", "/waiting", "/tasks", "/search", "/brief", "/shutdown"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden" aria-label="Navegación principal">
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          if (item.icon === null) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link href={item.href} aria-label="Hablar con LÍA" aria-current={active ? "page" : undefined} className="group -mt-6 flex flex-col items-center gap-1">
                  <span className={cn("grid h-[58px] w-[58px] place-items-center rounded-full border border-line bg-surface shadow-[var(--shadow-lg)] transition-transform group-active:scale-95", active && "ring-4 ring-accent-soft")}>
                    <LiaOrb size={40} />
                  </span>
                  <span className={cn("text-[10.5px] font-semibold tracking-wide", active ? "text-ink" : "text-ink-3")}>LÍA</span>
                </Link>
              </li>
            );
          }
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors">
                <Icon className={cn("h-[22px] w-[22px] transition-colors", active ? "text-ink" : "text-ink-3")} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span className={cn("text-[10.5px] font-medium", active ? "text-ink" : "text-ink-3")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const SIDEBAR_SECTIONS = [
  { title: null, items: [{ href: "/", label: "Inicio" }, { href: "/today", label: "Hoy" }, { href: "/lia", label: "LÍA" }, { href: "/life", label: "Vida" }] },
  { title: "Sistema", items: [{ href: "/goals", label: "Objetivos" }, { href: "/projects", label: "Proyectos" }, { href: "/tasks", label: "Tareas" }, { href: "/inbox", label: "Inbox" }, { href: "/waiting", label: "En espera" }] },
  { title: "Reflexión", items: [{ href: "/reviews", label: "Revisiones" }, { href: "/decisions", label: "Decisiones" }, { href: "/metrics", label: "Métricas" }, { href: "/people", label: "Personas" }] },
];

export function Sidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg-tint px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <LiaOrb size={34} />
        <span>
          <span className="display block text-xl leading-none">LÍA</span>
          <span className="text-[11px] text-ink-3">Life Operating System</span>
        </span>
      </Link>
      <button onClick={onOpenPalette} className="mb-6 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-strong">
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar o ejecutar…</span>
        <kbd className="rounded-md border border-line px-1.5 text-[11px]">⌘K</kbd>
      </button>
      <nav className="flex-1 space-y-6 overflow-y-auto" aria-label="Navegación">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title ?? "main"}>
            {section.title ? <p className="eyebrow mb-2 px-3">{section.title}</p> : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("block rounded-xl px-3 py-2 text-[14px] transition-colors", active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:bg-surface/60 hover:text-ink")}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <Link href="/settings" className="rounded-xl px-3 py-2 text-[14px] text-ink-2 hover:text-ink">Ajustes</Link>
    </aside>
  );
}

export function MobileTopActions({ onOpenPalette, onCapture }: { onOpenPalette: () => void; onCapture: () => void }) {
  return (
    <div className="fixed right-3 top-[max(env(safe-area-inset-top),10px)] z-30 flex gap-1.5 lg:hidden">
      <button onClick={onOpenPalette} className="glass grid h-10 w-10 place-items-center rounded-full border border-line text-ink-2 shadow-sm" aria-label="Buscar">
        <Search className="h-[18px] w-[18px]" />
      </button>
      <button onClick={onCapture} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-bg shadow-[var(--shadow)]" aria-label="Capturar">
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
