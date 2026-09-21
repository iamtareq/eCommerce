import Image from "next/image";
import Link from "next/link";
import { abtn, Badge, Card, EmptyState, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatTaka } from "@/lib/money";

export const metadata = { title: "Products" };

const STATUS_TONE = { ACTIVE: "green", DRAFT: "gray", ARCHIVED: "amber" } as const;

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
          <div className={table.wrap}>
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
                {products.map((p) => {
                  const active = p.variants.filter((v) => v.isActive);
                  const prices = active.map((v) => v.price);
                  const tracked = active.filter((v) => v.stock != null);
                  const stock = tracked.length === active.length && active.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null;
                  return (
                    <tr key={p.id} className="hover:bg-paper">
                      <td className={table.td}>
                        <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line bg-sand">
                            {p.images[0] ? (
                              <Image src={p.images[0].url} alt="" fill sizes="48px" className="object-cover" />
                            ) : (
                              <Icon name="image" className="m-3.5 size-5 text-muted" />
                            )}
                          </span>
                          <span>
                            <span className="block font-semibold text-ink hover:text-pine-800">{p.name}</span>
                            <span className="block text-xs text-muted">
                              {p.category?.name ?? "No category"} · {active.length} variant{active.length === 1 ? "" : "s"}
                              {p.isFeatured ? " · Featured" : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className={table.td}>
                        <Badge tone={STATUS_TONE[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</Badge>
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>
                        {prices.length === 0
                          ? "—"
                          : Math.min(...prices) === Math.max(...prices)
                            ? formatTaka(prices[0]!)
                            : `${formatTaka(Math.min(...prices))} – ${formatTaka(Math.max(...prices))}`}
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>
                        {stock == null ? <span className="text-muted">Not tracked</span> : stock === 0 ? <Badge tone="red">Out of stock</Badge> : stock}
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>{p._count.orderItems}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
