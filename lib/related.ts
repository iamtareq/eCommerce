import type { ProductCard } from "@/lib/catalog";

/**
 * Products to suggest on a product page: the same category first, then the rest;
 * in-stock before sold-out within each group, keeping the catalog's own order.
 */
export function relatedProducts(all: ProductCard[], current: { id: string; categorySlug: string | null }, limit = 4): ProductCard[] {
  const rank = (p: ProductCard) => (current.categorySlug && p.categorySlug === current.categorySlug ? 0 : 2) + (p.inStock ? 0 : 1);
  return all
    .filter((p) => p.id !== current.id)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .slice(0, limit)
    .map(({ p }) => p);
}
