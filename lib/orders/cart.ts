import type { TransactionClient } from "@/lib/db";
import { prisma } from "@/lib/db";
import type { PricedVariant, QuantityTier } from "@/lib/pricing";
import { toBanglaDigits } from "@/lib/phone";

export type LineIssueCode = "NOT_FOUND" | "UNAVAILABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "MAX_EXCEEDED";

export interface LineIssue {
  variantId: string;
  code: LineIssueCode;
  message: string;
  /** Largest quantity that would be accepted for this line (0 = none). */
  maxQuantity: number;
}

export interface CartLine {
  variant: PricedVariant;
  quantity: number;
  image: { url: string; alt: string } | null;
  /** Null = stock not tracked. */
  stock: number | null;
  maxQuantity: number;
}

export interface LoadedCart {
  lines: CartLine[];
  issues: LineIssue[];
  tiers: QuantityTier[];
}

/**
 * Lock order for variant rows. Every transaction that changes the stock of
 * several variants does so in this order, so two of them can never wait on
 * each other (deadlock). Plain code-unit comparison, not locale-aware.
 */
export function byVariantId(a: { variantId: string | null }, b: { variantId: string | null }): number {
  const x = a.variantId ?? "";
  const y = b.variantId ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Merges duplicate variant lines, keeping first-seen order. */
export function mergeLines(lines: { variantId: string; quantity: number }[]) {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.variantId, (map.get(l.variantId) ?? 0) + l.quantity);
  return [...map.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Loads current catalog data for the requested lines and reports anything that
 * prevents ordering them (unavailable product, stock, per-order limits).
 */
export async function loadCart(
  requested: { variantId: string; quantity: number }[],
  defaultMaxPerOrder: number,
  db: TransactionClient | typeof prisma = prisma,
): Promise<LoadedCart> {
  const merged = mergeLines(requested);
  const variants = await db.productVariant.findMany({
    where: { id: { in: merged.map((l) => l.variantId) } },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          quantityDiscounts: { where: { isActive: true } },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: CartLine[] = [];
  const issues: LineIssue[] = [];

  for (const req of merged) {
    const v = byId.get(req.variantId);
    if (!v) {
      issues.push({ variantId: req.variantId, code: "NOT_FOUND", message: "এই পণ্যটি আর পাওয়া যাচ্ছে না।", maxQuantity: 0 });
      continue;
    }
    if (!v.isActive || v.product.status !== "ACTIVE") {
      issues.push({ variantId: v.id, code: "UNAVAILABLE", message: "এই পণ্যটি এখন পাওয়া যাচ্ছে না।", maxQuantity: 0 });
      continue;
    }
    const maxPerOrder = v.product.maxPerOrder ?? defaultMaxPerOrder;
    const stockCap = v.stock == null ? maxPerOrder : Math.min(maxPerOrder, Math.max(0, v.stock));
    if (v.stock != null && v.stock <= 0) {
      issues.push({ variantId: v.id, code: "OUT_OF_STOCK", message: "দুঃখিত, এই পণ্যটির স্টক শেষ।", maxQuantity: 0 });
      continue;
    }
    if (v.stock != null && req.quantity > v.stock) {
      issues.push({
        variantId: v.id,
        code: "INSUFFICIENT_STOCK",
        message: `দুঃখিত, এই পণ্যটি মাত্র ${toBanglaDigits(v.stock)}টি স্টকে আছে।`,
        maxQuantity: stockCap,
      });
    }
    const img = v.product.images[0];
    lines.push({
      variant: {
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        productSlug: v.product.slug,
        variantName: v.name,
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
      },
      quantity: req.quantity,
      image: img ? { url: img.url, alt: img.alt || v.product.name } : null,
      stock: v.stock,
      maxQuantity: stockCap,
    });
  }

  // Per-product limit applies to the product's total quantity across variants.
  const productTotals = new Map<string, number>();
  for (const l of lines) productTotals.set(l.variant.productId, (productTotals.get(l.variant.productId) ?? 0) + l.quantity);
  for (const l of lines) {
    const v = byId.get(l.variant.variantId)!;
    const max = v.product.maxPerOrder ?? defaultMaxPerOrder;
    const total = productTotals.get(l.variant.productId) ?? 0;
    if (total > max && !issues.some((i) => i.variantId === l.variant.variantId)) {
      issues.push({
        variantId: l.variant.variantId,
        code: "MAX_EXCEEDED",
        message: `এই পণ্যটি একটি অর্ডারে সর্বোচ্চ ${toBanglaDigits(max)}টি নেওয়া যাবে।`,
        maxQuantity: Math.max(0, max - (total - l.quantity)),
      });
    }
  }

  const tiers: QuantityTier[] = [];
  const seenProducts = new Set<string>();
  for (const v of variants) {
    if (seenProducts.has(v.productId)) continue;
    seenProducts.add(v.productId);
    for (const t of v.product.quantityDiscounts) {
      tiers.push({ productId: v.productId, minQuantity: t.minQuantity, type: t.type, value: t.value });
    }
  }

  return { lines, issues, tiers };
}
