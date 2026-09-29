import type { Metadata } from "next";
import { BarChart3, Bell, Lightbulb, Wrench, ClipboardCheck, FolderKanban, Hourglass, Inbox, ListChecks, Scale, Search, Settings, Sun, Target, Users } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Divided, PageHeader, RowLink, SectionTitle } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Más" };

const GROUPS = [
  { title: "Dirección", items: [
    { href: "/goals", label: "Objetivos", sub: "Lo que quieres conseguir", icon: Target },
    { href: "/projects", label: "Proyectos", sub: "Resultados en marcha", icon: FolderKanban },
    { href: "/tasks", label: "Tareas", sub: "Todas tus acciones", icon: ListChecks },
  ] },
  { title: "Bucles abiertos", items: [
    { href: "/inbox", label: "Inbox", sub: "Capturas por revisar, ideas y notas", icon: Inbox },
    { href: "/waiting", label: "En espera", sub: "Lo que otros te deben", icon: Hourglass },
    { href: "/decisions", label: "Decisiones", sub: "Diario de decisiones", icon: Scale },
  ] },
  { title: "Revisión", items: [
    { href: "/brief", label: "Daily Brief", sub: "Tu mañana en un minuto", icon: Sun },
    { href: "/reviews", label: "Revisiones", sub: "Semanal, mensual y cierres", icon: ClipboardCheck },
    { href: "/metrics", label: "Métricas", sub: "Sueño, foco, finanzas", icon: BarChart3 },
    { href: "/people", label: "Personas", sub: "Contexto humano", icon: Users },
  ] },
  { title: "Aprendizaje", items: [
    { href: "/insights", label: "Patrones", sub: "Qué relaciona tu energía con tus resultados", icon: Lightbulb },
    { href: "/failures", label: "Aprendizajes", sub: "Errores sin culpa, ajustes con sistema", icon: Wrench },
  ] },
  { title: "Sistema", items: [
    { href: "/notifications", label: "Notificaciones", sub: "Brief, vencimientos y seguimientos", icon: Bell },
    { href: "/search", label: "Buscar", sub: "En todo LÍA", icon: Search },
    { href: "/settings", label: "Ajustes", sub: "Perfil, privacidad, datos", icon: Settings },
  ] },
];

export default function MorePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Más" />
      {GROUPS.map((g) => (
        <section key={g.title}>
          <SectionTitle title={g.title} />
          <Divided>
            {g.items.map((it) => <RowLink key={it.href} href={it.href} icon={<it.icon className="h-[18px] w-[18px]" />} title={it.label} subtitle={it.sub} />)}
          </Divided>
        </section>
      ))}
      <LogoutButton />
    </div>
  );
}
