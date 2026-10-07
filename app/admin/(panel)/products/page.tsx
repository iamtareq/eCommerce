import Image from "next/image";
import Link from "next/link";
import { abtn, Badge, Card, EmptyState, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatTaka } from "@/lib/money";

export const metadata = { title: "Products" };

const STATUS_TONE = { ACTIVE: "green", DRAFT: "gray", ARCHIVED: "amber" } as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_TONE }) {
  return <Badge tone={STATUS_TONE[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

function StockLabel({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="text-muted">Not tracked</span>;
  return stock === 0 ? <Badge tone="red">Out of stock</Badge> : <>{stock}</>;
}

function Thumb({ url }: { url?: string }) {
  return (
    <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line bg-sand">
      {url ? <Image src={url} alt="" fill sizes="48px" className="object-cover" /> : <Icon name="image" className="m-3.5 size-5 text-muted" />}
    </span>
  );
}

function details(category: string | undefined, variants: number, featured: boolean): string {
  return `${category ?? "No category"} · ${variants} variant${variants === 1 ? "" : "s"}${featured ? " · Featured" : ""}`;
}

export default async function ProductsAdminPage() {
  await requireOwner();
  const products = await prisma.product.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { orderBy: { sortOrder: "asc" } },
      _count: { select: { orderItems: true } },
    },
  });
  const rows = products.map((p) => {
    const active = p.variants.filter((v) => v.isActive);
    const prices = active.map((v) => v.price);
    const tracked = active.filter((v) => v.stock != null);
    const stock = tracked.length === active.length && active.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null;
    const price =
      prices.length === 0
        ? "—"
        : Math.min(...prices) === Math.max(...prices)
          ? formatTaka(prices[0]!)
          : `${formatTaka(Math.min(...prices))} – ${formatTaka(Math.max(...prices))}`;
    return { p, active, price, stock };
  });

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything customers can order. Prices and discounts are set per product."
        actions={
          <Link href="/admin/products/new" className={`${abtn.primary} ${abtn.md}`}>
            <Icon name="plus" className="size-4" /> New product
          </Link>
        }
      />
      <Card padded={false}>
        {products.length === 0 ? (
          <EmptyState icon="package" title="No products yet">
            <Link href="/admin/products/new" className="font-semibold text-pine-700 underline">
              Create your first product
            </Link>
          </EmptyState>
        ) : (
          <>
            <ul className={table.cards}>
              {rows.map(({ p, active, price, stock }) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className={`${table.card} flex items-center gap-3 hover:bg-paper`}>
                    <Thumb url={p.images[0]?.url} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-ink">{p.name}</span>
                        <StatusBadge status={p.status} />
                      </span>
                      <span className="block text-xs text-muted">{details(p.category?.name, active.length, p.isFeatured)}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="text-sm font-semibold text-ink tabular-nums">{price}</span>
                        <span>
                          Stock: <StockLabel stock={stock} />
                        </span>
                        <span>{p._count.orderItems} ordered</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className={table.desktopWrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Product</th>
                    <th className={table.th}>Status</th>
                    <th className={`${table.th} text-right`}>Price</th>
                    <th className={`${table.th} text-right`}>Stock</th>
                    <th className={`${table.th} text-right`}>Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, active, price, stock }) => (
                    <tr key={p.id} className="hover:bg-paper">
                      <td className={table.td}>
                        <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                          <Thumb url={p.images[0]?.url} />
                          <span>
                            <span className="block font-semibold text-ink hover:text-pine-800">{p.name}</span>
                            <span className="block text-xs text-muted">{details(p.category?.name, active.length, p.isFeatured)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={table.td}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>{price}</td>
                      <td className={`${table.td} text-right tabular-nums`}>
                        <StockLabel stock={stock} />
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>{p._count.orderItems}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
