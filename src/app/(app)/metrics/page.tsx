import type { Metadata } from "next";
import { listMetricsWithLatest, metricSeries, monthCashflow, recentTransactions } from "@/application/metrics";
import { logExpenseAction, logMetricAction } from "@/app/actions/life";
import { ActionForm } from "@/components/features/forms";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { Card, PageHeader, Progress, SectionTitle, Segmented } from "@/components/ui/primitives";
import { Sparkline } from "@/components/ui/sparkline";
import { formatRelative } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { loadAsUser } from "@/server/action";

export const metadata: Metadata = { title: "Métricas" };

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "finanzas" ? "finanzas" : "salud";
  const data = await loadAsUser(async (ctx) => ({
    metrics: await listMetricsWithLatest(ctx),
    sleep: await metricSeries(ctx, "sleep_hours", 30),
    cash: await monthCashflow(ctx),
    txs: await recentTransactions(ctx, 15),
    today: ctx.today,
    currency: ctx.currency,
  }));
  return (
    <div className="space-y-6">
      <PageHeader title="Métricas" subtitle="Solo lo que ayuda a decidir." />
      <Segmented active={`/metrics?tab=${tab}`} items={[{ href: "/metrics?tab=salud", label: "Hábitos y energía" }, { href: "/metrics?tab=finanzas", label: "Finanzas" }]} />
      {tab === "salud" ? (
        <>
          <Card className="p-4">
            <p className="eyebrow">Sueño · 30 días</p>
            <Sparkline className="mt-3 h-16 w-full" points={data.sleep.map((s) => ({ label: s.date, value: s.value }))} />
          </Card>
          <div className="grid grid-cols-2 gap-2.5">
            {data.metrics.map(({ metric, latest, latestDate, weekAvg, weekSum, weekCount }) => {
              const week = metric.aggregation === "SUM" ? weekSum : weekAvg;
              return (
                <div key={metric.id} className="card p-4">
                  <p className="eyebrow">{metric.name}</p>
                  <p className="display mt-1.5 text-2xl">{latest === null ? "—" : fmt(latest)}<span className="ml-1 text-sm text-ink-3">{metric.unit}</span></p>
                  <p className="mt-1 text-[12px] text-ink-3">{latestDate ? formatRelative(latestDate, data.today) : "Sin datos"}{week !== null && weekCount > 0 ? ` · 7d ${metric.aggregation === "SUM" ? "total" : "prom."} ${fmt(week)}` : ""}</p>
                  {metric.target && week !== null ? <Progress className="mt-2" value={(week / metric.target) * 100} tone={week >= metric.target ? "good" : "accent"} /> : null}
                </div>
              );
            })}
          </div>
          <section>
            <SectionTitle title="Registrar" />
            <ActionForm action={logMetricAction} className="card flex gap-2 p-3">
              <Select name="key" className="h-11 flex-1" defaultValue="sleep_hours" aria-label="Métrica">
                {data.metrics.map(({ metric }) => <option key={metric.key} value={metric.key}>{metric.name}</option>)}
              </Select>
              <Input name="value" type="number" step="any" required placeholder="Valor" className="h-11 w-24" inputMode="decimal" />
              <Button type="submit" className="h-11">Guardar</Button>
            </ActionForm>
            <p className="mt-2 px-1 text-[12.5px] text-ink-3">O simplemente escribe “dormí 6 horas” en la captura rápida.</p>
          </section>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="card p-4"><p className="eyebrow">Ingresos del mes</p><p className="display mt-1.5 text-xl text-good">{formatMoney(data.cash.income, data.currency)}</p></div>
            <div className="card p-4"><p className="eyebrow">Gastos del mes</p><p className="display mt-1.5 text-xl">{formatMoney(data.cash.expenses, data.currency)}</p></div>
          </div>
          <p className="px-1 text-[12.5px] text-ink-3">Esto es flujo de caja del mes, no patrimonio. LÍA nunca los mezcla.</p>
          {data.cash.byCategory.length > 0 ? (
            <Card className="space-y-3 p-4">
              <p className="eyebrow">Gastos por categoría</p>
              {data.cash.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex justify-between text-[13.5px]"><span>{c.category}</span><span className="tabular-nums text-ink-2">{formatMoney(c.total, data.currency)}</span></div>
                  <Progress value={(c.total / data.cash.expenses) * 100} tone="neutral" />
                </div>
              ))}
            </Card>
          ) : null}
          <section>
            <SectionTitle title="Registrar movimiento" />
            <ActionForm action={logExpenseAction} className="card grid grid-cols-2 gap-2 p-3">
              <Select name="kind" defaultValue="EXPENSE" aria-label="Tipo" className="h-11"><option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option></Select>
              <Input name="amount" type="number" min={1} step="any" required placeholder="Monto" className="h-11" inputMode="decimal" />
              <Input name="description" placeholder="Descripción" className="h-11" />
              <Input name="category" placeholder="Categoría" className="h-11" />
              <Button type="submit" className="col-span-2">Guardar</Button>
            </ActionForm>
          </section>
          {data.txs.length > 0 ? (
            <Card as="div" className="divide-y divide-line">
              {data.txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-[14.5px]">{t.description ?? t.category ?? "Movimiento"}</p><p className="text-[12px] text-ink-3">{t.category} · {formatRelative(t.occurredOn, data.today)}</p></div>
                  <p className={t.kind === "INCOME" ? "tabular-nums text-good" : "tabular-nums"}>{t.kind === "INCOME" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</p>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
