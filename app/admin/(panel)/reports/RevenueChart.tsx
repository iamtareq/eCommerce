import { cn } from "@/lib/cn";
import { formatTaka } from "@/lib/money";

interface Bucket {
  label: string;
  orders: number;
  revenue: number;
}

/** Daily buckets for up to ~2 months; longer ranges are summed by week so bars stay readable. */
export function toBuckets(days: { date: string; orders: number; revenue: number }[]): { buckets: Bucket[]; weekly: boolean } {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  if (days.length <= 62) return { buckets: days.map((d) => ({ label: fmt(d.date), orders: d.orders, revenue: d.revenue })), weekly: false };
  const buckets: Bucket[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7);
    buckets.push({
      label: `${fmt(week[0]!.date)} – ${fmt(week[week.length - 1]!.date)}`,
      orders: week.reduce((s, d) => s + d.orders, 0),
      revenue: week.reduce((s, d) => s + d.revenue, 0),
    });
  }
  return { buckets, weekly: true };
}

/** A rounded axis maximum (1, 2 or 5 × a power of ten) at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((m) => m * power >= value) ?? 10) * power;
}

/**
 * Revenue per day (or week) as one series of thin bars. Each bar has a hover/focus
 * tooltip over a full-height hit area, and the same numbers are in the table below it.
 */
export function RevenueChart({ days }: { days: { date: string; orders: number; revenue: number }[] }) {
  const { buckets, weekly } = toBuckets(days);
  const max = niceMax(Math.max(...buckets.map((b) => b.revenue)));
  const ticks = [max, max / 2, 0];

  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-sm text-muted">Revenue per {weekly ? "week" : "day"} (cancelled orders excluded)</figcaption>
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="flex h-56 w-14 shrink-0 flex-col justify-between text-right text-xs text-muted tabular-nums" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatTaka(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-56 border-b border-line-strong">
            {/* Recessive gridlines */}
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
            <ol className="absolute inset-0 flex items-end gap-0.5" aria-label="Revenue by day">
              {buckets.map((b, i) => (
                <li
                  key={b.label}
                  tabIndex={0}
                  aria-label={`${b.label}: ${formatTaka(b.revenue)}, ${b.orders} order${b.orders === 1 ? "" : "s"}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  <span
                    className="block w-full max-w-12 rounded-t-[4px] bg-pine-600 transition-colors group-hover:bg-pine-800 group-focus-visible:bg-pine-800"
                    style={{ height: `${(b.revenue / max) * 100}%`, minHeight: b.revenue > 0 ? 2 : 0 }}
                  />
                  <span
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap text-ink shadow-lift group-hover:block group-focus-visible:block",
                      // Opens away from the nearer edge so it never leaves the chart.
                      i < buckets.length / 3 ? "left-0" : i >= (buckets.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <span className="block font-semibold">{b.label}</span>
                    <span className="block tabular-nums">{formatTaka(b.revenue)}</span>
                    <span className="block text-muted">
                      {b.orders} order{b.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted" aria-hidden="true">
            <span>{buckets[0]?.label}</span>
            <span>{buckets[buckets.length - 1]?.label}</span>
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-pine-700">Show as table</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-paper text-xs text-muted uppercase">
              <tr>
                <th className="px-3 py-2">{weekly ? "Week" : "Day"}</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.label} className="border-t border-line">
                  <td className="px-3 py-1.5">{b.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.orders}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatTaka(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
