import Link from "next/link";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { SyncPendingButton } from "@/components/admin/SyncPendingButton";
import { abtn, ainput, alabel, Card, PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { isOrderStatus, isSyncStatus, ORDER_STATUSES, SYNC_STATUSES } from "@/config/order";
import { requireAdmin } from "@/lib/auth/guard";
import { cn } from "@/lib/cn";
import { listOrders, type OrderFilters } from "@/lib/orders/admin";

export const metadata = { title: "Orders" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = one(sp.status) ?? "";
  const sync = one(sp.sync) ?? "";
  const filters: OrderFilters = {
    q: one(sp.q)?.slice(0, 100),
    status: isOrderStatus(status) ? status : undefined,
    sync: isSyncStatus(sync) ? sync : undefined,
    from: isDate(one(sp.from)) ? one(sp.from) : undefined,
    to: isDate(one(sp.to)) ? one(sp.to) : undefined,
    flagged: one(sp.flagged) === "1",
  };
  const page = Number(one(sp.page) ?? "1") || 1;
  const { orders, total, pageCount, page: current } = await listOrders(filters, page);

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, flagged: filters.flagged ? "1" : undefined })) {
    if (v) query.set(k, String(v));
  }
  const pageHref = (p: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(p));
    return `/admin/orders?${q.toString()}`;
  };
  const hasFilters = query.toString().length > 0;

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}${hasFilters ? " match the filters" : ""}`}
        actions={
          <>
            <SyncPendingButton />
            <a href={`/api/orders/export?${query.toString()}`} className={`${abtn.secondary} ${abtn.md}`}>
              <Icon name="download" className="size-4" /> Export CSV
            </a>
          </>
        }
      />

      <Card className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="q" className={alabel}>
              Search
            </label>
            <input id="q" name="q" defaultValue={filters.q} placeholder="Order no., name or phone" className={ainput} />
          </div>
          <div>
            <label htmlFor="status" className={alabel}>
              Status
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className={ainput}>
              <option value="">All</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sync" className={alabel}>
              Sheet sync
            </label>
            <select id="sync" name="sync" defaultValue={filters.sync ?? ""} className={ainput}>
              <option value="">All</option>
              {SYNC_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className={alabel}>
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={filters.from} className={ainput} />
          </div>
          <div>
            <label htmlFor="to" className={alabel}>
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className={ainput} />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={cn(abtn.primary, abtn.md)}>
              <Icon name="search" className="size-4" /> Filter
            </button>
            {hasFilters && (
              <Link href="/admin/orders" className={cn(abtn.ghost, abtn.md)}>
                Clear
              </Link>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2 lg:col-span-6">
            <input type="checkbox" name="flagged" value="1" defaultChecked={filters.flagged} className="size-4 accent-pine-700" />
            Only flagged orders (same phone ordered recently)
          </label>
        </form>
      </Card>

      <Card padded={false}>
        <OrdersTable orders={orders} />
        {pageCount > 1 && (
          <nav className="flex items-center justify-between gap-2 px-4 py-3 text-sm" aria-label="Pagination">
            <span className="text-muted">
              Page {current} of {pageCount}
            </span>
            <span className="flex gap-2">
              {current > 1 && (
                <Link href={pageHref(current - 1)} className={`${abtn.secondary} ${abtn.sm}`}>
                  Previous
                </Link>
              )}
              {current < pageCount && (
                <Link href={pageHref(current + 1)} className={`${abtn.secondary} ${abtn.sm}`}>
                  Next
                </Link>
              )}
            </span>
          </nav>
        )}
      </Card>
    </>
  );
}
