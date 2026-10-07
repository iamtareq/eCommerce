import Link from "next/link";
import { OrderStatusBadge } from "@/components/admin/StatusBadges";
import { abtn, ainput, alabel, Card, EmptyState, PageHeader, StatCard, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { ORDER_STATUSES } from "@/config/order";
import { requireOwner } from "@/lib/auth/guard";
import { cn } from "@/lib/cn";
import { formatTaka } from "@/lib/money";
import { REPORT_PRESETS, resolveReportRange, salesReport } from "@/lib/reports";
import { RevenueChart } from "./RevenueChart";

export const metadata = { title: "Sales report" };

type Params = { preset?: string | string[]; from?: string | string[]; to?: string | string[] };
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const range = resolveReportRange({ preset: one(params.preset), from: one(params.from), to: one(params.to) });
  const report = await salesReport(range);
  const all = report.orders + report.cancelled;
  const statusOrder = (s: string) => ORDER_STATUSES.findIndex((x) => x.value === s);

  return (
    <>
      <PageHeader title="Sales report" description={`${range.from} to ${range.to} · Bangladesh time`} />

      {/* Filters: presets and a custom range, in one row. */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <nav aria-label="Report period" className="flex flex-wrap gap-2">
            {REPORT_PRESETS.map((p) => (
              <Link
                key={p.value}
                href={`/admin/reports?preset=${p.value}`}
                aria-current={range.preset === p.value ? "page" : undefined}
                className={cn(range.preset === p.value ? abtn.primary : abtn.secondary, abtn.md)}
              >
                {p.label}
              </Link>
            ))}
          </nav>
          <form method="get" className="flex flex-wrap items-end gap-2 sm:ml-auto">
            <div>
              <label htmlFor="from" className={alabel}>
                From
              </label>
              <input id="from" name="from" type="date" defaultValue={range.from} className={ainput} />
            </div>
            <div>
              <label htmlFor="to" className={alabel}>
                To
              </label>
              <input id="to" name="to" type="date" defaultValue={range.to} className={ainput} />
            </div>
            <button type="submit" className={cn(abtn.secondary, abtn.md)}>
              Show
            </button>
          </form>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatTaka(report.revenue)} icon="sparkles" tone="green" />
        <StatCard label="Orders" value={report.orders} icon="bag" tone="blue" />
        <StatCard label="Average order" value={formatTaka(report.averageOrder)} icon="tag" tone="violet" />
        <StatCard label="Items sold" value={report.itemsSold} icon="package" tone="amber" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Revenue is what customers pay (delivery and gift wrapping included). Cancelled orders are left out
        {report.cancelled > 0 && `: ${report.cancelled} of ${all} order${all === 1 ? "" : "s"} in this period (${Math.round((report.cancelled / all) * 100)}%)`}.
      </p>

      <Card title="Revenue over time" className="mt-6">
        {report.orders === 0 ? <EmptyState icon="list" title="No orders in this period" /> : <RevenueChart days={report.days} />}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Top products" padded={false}>
          {report.topProducts.length === 0 ? (
            <EmptyState icon="package" title="Nothing sold in this period" />
          ) : (
            <div className={table.wrap}>
              {/* Three short columns fit a phone; no minimum width like the wide admin tables. */}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className={table.th}>Product</th>
                    <th className={`${table.th} text-right`}>Qty</th>
                    <th className={`${table.th} text-right`}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.name}>
                      <td className={`${table.td} font-medium`}>{p.name}</td>
                      <td className={`${table.td} text-right tabular-nums`}>{p.quantity}</td>
                      <td className={`${table.td} text-right font-semibold tabular-nums`}>{formatTaka(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-xs text-muted sm:px-5">Product revenue after quantity discounts, before coupons and delivery.</p>
            </div>
          )}
        </Card>

        <Card title="Orders by status" padded={false}>
          {report.byStatus.length === 0 ? (
            <EmptyState icon="list" title="No orders in this period" />
          ) : (
            <ul className="divide-y divide-line">
              {[...report.byStatus]
                .sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
                .map((s) => (
                  <li key={s.status} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <OrderStatusBadge status={s.status} />
                    <span className="text-right text-sm tabular-nums">
                      <span className="font-semibold text-ink">{s.count}</span>
                      <span className="text-muted"> · {formatTaka(s.revenue)}</span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm">
        <Link href={`/admin/orders?from=${range.from}&to=${range.to}`} className="inline-flex items-center gap-1 font-semibold text-pine-700 hover:underline">
          See these orders <Icon name="arrowRight" className="size-4" />
        </Link>
      </p>
    </>
  );
}
