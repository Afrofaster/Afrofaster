import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { listNotifications, markAllRead } from "@/application/notifications";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  // Opening the center marks everything as read (after loading, so unread still shows once).
  const data = await loadAsUser(async (ctx) => {
    const items = await listNotifications(ctx);
    await markAllRead(ctx);
    return { items, tz: ctx.timezone };
  });
  const fmt = new Intl.DateTimeFormat("es-CO", { timeZone: data.tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div className="space-y-5">
      <PageHeader title="Notificaciones" subtitle="Pocas y útiles. Tú defines el presupuesto en Ajustes." />
      {data.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="Sin notificaciones" body="LÍA solo te avisa cuando algo lo merece: tu brief, vencimientos, seguimientos, revisiones o riesgos." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.items.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "/"} className="flex gap-3 px-4 py-3.5 hover:bg-surface-2">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} aria-label={n.readAt ? undefined : "Nueva"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{n.title}</span>
                  {n.body ? <span className="block text-[13px] text-ink-2">{n.body}</span> : null}
                  <span className="text-[12px] text-ink-3">{fmt.format(n.scheduledFor)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
