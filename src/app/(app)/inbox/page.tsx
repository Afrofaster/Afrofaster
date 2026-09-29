import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { inboxTypeLabel, listInbox } from "@/application/capture";
import { InboxItemRow } from "@/components/features/inbox-item";
import { QuickCapture } from "@/components/features/quick-capture";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/primitives";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Inbox" };

const VIEWS = { review: "Por revisar", ideas: "Ideas", notes: "Notas", all: "Todo" } as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = (sp.view && sp.view in VIEWS ? sp.view : "review") as keyof typeof VIEWS;
  const data = await loadAsUser(async (ctx) => ({ items: await listInbox(ctx, view), tz: ctx.timezone }));
  const fmt = new Intl.DateTimeFormat("es-CO", { timeZone: data.tz, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div className="space-y-5">
      <PageHeader title="Inbox" subtitle="Todo entra aquí. LÍA organiza; tú decides lo dudoso." />
      <QuickCapture />
      <Segmented active={`/inbox?view=${view}`} items={Object.entries(VIEWS).map(([k, v]) => ({ href: `/inbox?view=${k}`, label: v }))} />
      {data.items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title={view === "review" ? "Inbox en cero" : "Nada por aquí aún"} body={view === "review" ? "Todo lo que capturaste ya está organizado." : "Captura una idea o nota cuando llegue."} />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.items.map((item) => (
            <InboxItemRow
              key={item.id}
              id={item.id}
              text={item.rawText}
              typeLabel={inboxTypeLabel(item.type)}
              status={item.status}
              when={fmt.format(item.createdAt)}
              suggestion={(item.parsed?.suggestion as { action?: string; taskTitle?: string; title?: string } | undefined) ?? null}
              error={item.status === "NEEDS_REVIEW" ? item.error : null}
              reviewable={item.status === "PENDING" || item.status === "NEEDS_REVIEW"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
