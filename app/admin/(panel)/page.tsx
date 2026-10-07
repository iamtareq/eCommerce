import Link from "next/link";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { abtn, Badge, Card, Notice, PageHeader, StatCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getSheetsConfig } from "@/lib/google-sheets/config";
import { countOpenLeads } from "@/lib/leads";
import { formatTaka } from "@/lib/money";
import { dashboardStats } from "@/lib/orders/admin";
import { lowStockSummary } from "@/lib/stock";

export const metadata = { title: "Dashboard" };

/**
 * Warning text when any delivery zone charges ৳0 (often a charge the owner forgot to set), or null.
 * `zones` must be in checkout order: the default zone — or the first one if none is marked — covers
 * every district without its own rule (see resolveZone).
 */
function freeDeliveryWarning(zones: { name: string; charge: number; isDefault: boolean }[]): string | null {
  const free = zones.filter((z) => z.charge === 0);
  if (free.length === 0) return null;
  if (free.length === zones.length) return "Every delivery zone charges ৳0, so customers currently see free delivery.";
  const names = free.map((z) => `“${z.name}”`).join(", ");
  const head = free.length === 1 ? `The ${names} zone charges ৳0` : `The ${names} zones charge ৳0`;
  const fallback = zones.find((z) => z.isDefault) ?? zones[0];
  if (fallback?.charge === 0) {
    return `${head}. ${free.length === 1 ? "It" : `“${fallback.name}”`} is the default zone, so every district not assigned to another zone gets free delivery.`;
  }
  return `${head}, so customers there get free delivery.`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdmin();
  const { denied } = await searchParams;
  const [stats, recent, productCount, zones, lowStock, openLeads] = await Promise.all([
    dashboardStats(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: { select: { productName: true, variantName: true, quantity: true } } },
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    // Same order as checkout (lib/catalog.ts loadDeliveryConfig), so the fallback zone matches.
    prisma.deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { charge: "asc" }],
      select: { name: true, charge: true, isDefault: true },
    }),
    lowStockSummary(),
    countOpenLeads(),
  ]);
  const zoneCount = zones.length;
  const freeWarning = freeDeliveryWarning(zones);
  const sheetsConfigured = !!getSheetsConfig();

  return (
    <>
      <PageHeader
        title={`Assalamu alaikum, ${admin.displayName}`}
        description="Here is what is happening with your store today."
        actions={
          <Link href="/admin/orders?status=PENDING" className={`${abtn.primary} ${abtn.md}`}>
            Pending orders ({stats.pending})
          </Link>
        }
      />

      <div className="mb-6 space-y-2">
        {denied && <Notice tone="warning">That section is available to the store owner only.</Notice>}
        {!sheetsConfigured && (
          <Notice tone="warning">
            Google Sheets is not configured — orders are saved safely in the database but are not copied to the sheet yet. See
            README → &ldquo;Google Sheets&rdquo;.
          </Notice>
        )}
        {openLeads > 0 && (
          <Notice tone="info">
            {openLeads} incomplete order{openLeads === 1 ? "" : "s"} to call: people who started checkout but did not finish.{" "}
            <Link href="/admin/leads" className="font-semibold underline">
              See them
            </Link>
          </Notice>
        )}
        {stats.syncFailed > 0 && (
          <Notice tone="error">
            {stats.syncFailed} order(s) failed to sync to Google Sheets.{" "}
            <Link href="/admin/orders?sync=FAILED" className="font-semibold underline">
              Review and retry
            </Link>
          </Notice>
        )}
        {admin.role === "OWNER" && productCount === 0 && (
          <Notice tone="info">
            No active products yet.{" "}
            <Link href="/admin/products/new" className="font-semibold underline">
              Add your first product
            </Link>
          </Notice>
        )}
        {admin.role === "OWNER" && zoneCount === 0 && (
          <Notice tone="warning">
            No delivery zones configured — customers cannot order until you{" "}
            <Link href="/admin/delivery" className="font-semibold underline">
              set delivery charges
            </Link>
            .
          </Notice>
        )}
        {admin.role === "OWNER" && freeWarning && (
          <Notice tone="warning">
            {freeWarning}{" "}
            <Link href="/admin/delivery" className="font-semibold underline">
              Set your real delivery charges
            </Link>{" "}
            (skip this only if delivery really is free).
          </Notice>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Today's orders" value={stats.todayCount} icon="bag" tone="blue" href="/admin/orders" />
        <StatCard label="Today's revenue" value={formatTaka(stats.todayRevenue)} icon="sparkles" tone="green" />
        <StatCard label="Total orders" value={stats.total} icon="list" tone="gray" href="/admin/orders" />
        <StatCard label="Pending" value={stats.pending} icon="clock" tone="amber" href="/admin/orders?status=PENDING" />
        <StatCard label="Confirmed" value={stats.confirmed} icon="checkCircle" tone="indigo" href="/admin/orders?status=CONFIRMED" />
        <StatCard label="Shipped" value={stats.shipped} icon="truck" tone="violet" href="/admin/orders?status=SHIPPED" />
        <StatCard label="Delivered" value={stats.delivered} icon="package" tone="green" href="/admin/orders?status=DELIVERED" />
        <StatCard label="Cancelled" value={stats.cancelled} icon="x" tone="red" href="/admin/orders?status=CANCELLED" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Today = since midnight Bangladesh time. Revenue excludes cancelled orders. On hold: {stats.onHold} · Processing: {stats.processing}
      </p>

      {lowStock.variants.length > 0 && (
        <Card title={`Low stock (${lowStock.threshold} or fewer)`} className="mt-6" padded={false}>
          <ul className="divide-y divide-line">
            {lowStock.variants.map((v) => {
              const label = (
                <>
                  <span className="min-w-0 font-medium text-ink">{v.label}</span>
                  <Badge tone={v.stock === 0 ? "red" : "amber"}>{v.stock === 0 ? "Out of stock" : `${v.stock} left`}</Badge>
                </>
              );
              return (
                <li key={`${v.productId}-${v.label}`}>
                  {admin.role === "OWNER" ? (
                    <Link href={`/admin/products/${v.productId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper sm:px-5">
                      {label}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">{label}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card
        title="Latest orders"
        className="mt-6"
        padded={false}
        actions={
          <Link href="/admin/orders" className={`${abtn.secondary} ${abtn.sm}`}>
            View all
          </Link>
        }
      >
        <OrdersTable orders={recent} />
      </Card>
    </>
  );
}
