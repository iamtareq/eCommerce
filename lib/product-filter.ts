import type { ProductCard } from "@/lib/catalog";

export const PRODUCT_SORTS = [
  { value: "", label: "প্রস্তাবিত" },
  { value: "price-asc", label: "দাম: কম থেকে বেশি" },
  { value: "price-desc", label: "দাম: বেশি থেকে কম" },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export function parseSort(value: unknown): ProductSort {
  return PRODUCT_SORTS.some((s) => s.value === value) ? (value as ProductSort) : "";
}

/** Lower-case, Unicode-normalised text with collapsed spaces, so Bangla and English match the way people type. */
function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Filters the catalog by a search phrase (every word must appear in the name, short
 * description or category) and sorts it. The default sort keeps the admin's order;
 * sold-out products always come last.
 */
export function filterProducts(products: ProductCard[], query: string, sort: ProductSort): ProductCard[] {
  const words = normalize(query).split(" ").filter(Boolean);
  const matched = words.length
    ? products.filter((p) => {
        const haystack = normalize([p.name, p.shortDescription ?? "", p.categoryName ?? ""].join(" "));
        return words.every((w) => haystack.includes(w));
      })
    : products;
  const byPrice = sort === "price-asc" ? 1 : sort === "price-desc" ? -1 : 0;
  return matched
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Number(!a.p.inStock) - Number(!b.p.inStock) || byPrice * (a.p.price - b.p.price) || a.i - b.i)
    .map(({ p }) => p);
}
