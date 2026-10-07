import { itemLabel } from "@/config/order";
import { prisma } from "@/lib/db";

export interface LowStockVariant {
  productId: string;
  label: string;
  stock: number;
}

/** Variants on sale whose tracked stock is at or below the threshold, emptiest first. */
export async function lowStockVariants(threshold: number, take = 20): Promise<LowStockVariant[]> {
  if (threshold <= 0) return [];
  const rows = await prisma.productVariant.findMany({
    where: { isActive: true, stock: { not: null, lte: threshold }, product: { status: "ACTIVE" } },
    orderBy: [{ stock: "asc" }, { id: "asc" }],
    take,
    select: { stock: true, name: true, product: { select: { id: true, name: true, variants: { where: { isActive: true }, select: { id: true } } } } },
  });
  return rows.map((v) => ({
    productId: v.product.id,
    label: itemLabel(v.product.name, v.product.variants.length > 1 ? v.name : null),
    stock: v.stock ?? 0,
  }));
}

/**
 * Variants an order just took to or below the threshold: their stock is at or under it now
 * and was above it before this order's units left. Each crossing is reported once, by the
 * order that caused it, not by every later order. It reads the current stock, so run it right
 * after the order is placed; an order landing in between can make an alert repeat or go missing.
 */
export async function stockCrossedBy(orderId: string, threshold: number): Promise<LowStockVariant[]> {
  if (threshold <= 0) return [];
  const items = await prisma.orderItem.findMany({
    where: { orderId, stockReserved: true, variant: { stock: { not: null, lte: threshold } } },
    select: { quantity: true, productName: true, variantName: true, productId: true, variant: { select: { stock: true } } },
  });
  return items
    .filter((i) => (i.variant!.stock ?? 0) + i.quantity > threshold)
    .map((i) => ({ productId: i.productId ?? "", label: itemLabel(i.productName, i.variantName), stock: i.variant!.stock ?? 0 }));
}
