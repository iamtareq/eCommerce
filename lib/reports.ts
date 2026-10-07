import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { dhakaDayRange, dhakaIsoDate } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest range a report covers, so one request never scans years of orders day by day. */
export const MAX_REPORT_DAYS = 366;

export const REPORT_PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
] as const;

export interface ReportRange {
  /** Inclusive Dhaka calendar days, YYYY-MM-DD. */
  from: string;
  to: string;
  preset: string | null;
}

function addDays(isoDate: string, days: number): string {
  return dhakaIsoDate(new Date(dhakaDayRange(isoDate)!.start.getTime() + days * DAY_MS));
}

/**
 * The days a report covers: a preset, or a custom from/to (swapped if reversed, capped at
 * MAX_REPORT_DAYS ending on `to`). Anything invalid falls back to the last 30 days.
 */
export function resolveReportRange(params: { preset?: string; from?: string; to?: string }, now: Date = new Date()): ReportRange {
  const today = dhakaIsoDate(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (params.preset) {
    case "7d":
      return { from: addDays(today, -6), to: today, preset: "7d" };
    case "month":
      return { from: monthStart, to: today, preset: "month" };
    case "last-month": {
      const lastDay = addDays(monthStart, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay, preset: "last-month" };
    }
  }
  if (params.from && params.to && dhakaDayRange(params.from) && dhakaDayRange(params.to)) {
    let [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    if (to > today) to = today;
    if (from > to) from = to;
    const earliest = addDays(to, -(MAX_REPORT_DAYS - 1));
    if (from < earliest) from = earliest;
    return { from, to, preset: null };
  }
  return { from: addDays(today, -29), to: today, preset: "30d" };
}

export interface SalesReport {
  range: ReportRange;
  /** Orders that were not cancelled. */
  orders: number;
  revenue: number;
  averageOrder: number;
  itemsSold: number;
  cancelled: number;
  /** One entry per day in the range, zero-filled. */
  days: { date: string; orders: number; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  byStatus: { status: OrderStatus; count: number; revenue: number }[];
}

/**
 * Sales for a range of Dhaka days. Revenue is what customers pay (order totals, so
 * delivery and gift wrapping included); cancelled orders count only in `cancelled`
 * and `byStatus`.
 */
export async function salesReport(range: ReportRange): Promise<SalesReport> {
  const start = dhakaDayRange(range.from)!.start;
  const end = dhakaDayRange(range.to)!.end;
  const inRange = { createdAt: { gte: start, lt: end } };
  const live = { ...inRange, orderStatus: { not: "CANCELLED" as const } };

  const [daily, statusRows, productRows] = await Promise.all([
    prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      -- "createdAt" holds UTC without a zone: mark it as UTC first, then convert to Dhaka time.
      SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD') AS day,
             count(*)::int AS orders, coalesce(sum("totalAmount"), 0)::int AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "orderStatus" <> 'CANCELLED'
      GROUP BY 1 ORDER BY 1`,
    prisma.order.groupBy({ by: ["orderStatus"], where: inRange, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.orderItem.groupBy({
      by: ["productName", "variantName"],
      where: { order: live },
      _sum: { quantity: true, lineSubtotal: true, lineDiscount: true },
    }),
  ]);

  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days: SalesReport["days"] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    days.push({ date: d, orders: byDay.get(d)?.orders ?? 0, revenue: byDay.get(d)?.revenue ?? 0 });
  }

  const orders = days.reduce((s, d) => s + d.orders, 0);
  const revenue = days.reduce((s, d) => s + d.revenue, 0);
  const topProducts = productRows
    .map((r) => ({
      name: r.variantName ? `${r.productName} (${r.variantName})` : r.productName,
      quantity: r._sum.quantity ?? 0,
      revenue: (r._sum.lineSubtotal ?? 0) - (r._sum.lineDiscount ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 10);

  return {
    range,
    orders,
    revenue,
    averageOrder: orders ? Math.round(revenue / orders) : 0,
    itemsSold: productRows.reduce((s, r) => s + (r._sum.quantity ?? 0), 0),
    cancelled: statusRows.find((r) => r.orderStatus === "CANCELLED")?._count._all ?? 0,
    days,
    topProducts,
    byStatus: statusRows.map((r) => ({ status: r.orderStatus, count: r._count._all, revenue: r._sum.totalAmount ?? 0 })),
  };
}
