import { describe, expect, it } from "vitest";
import type { ProductCard } from "@/lib/catalog";
import { relatedProducts } from "@/lib/related";

const card = (id: string, categorySlug: string | null, inStock = true): ProductCard => ({
  id,
  slug: id,
  name: id,
  shortDescription: null,
  categoryName: categorySlug,
  categorySlug,
  image: null,
  price: 100,
  compareAtPrice: null,
  priceVaries: false,
  inStock,
  isFeatured: false,
});

describe("relatedProducts", () => {
  const all = [card("a", "box"), card("b", "frame"), card("c", "box", false), card("d", "box"), card("e", null), card("f", "frame")];

  it("puts the same category first, in stock before sold out, and leaves out the product itself", () => {
    expect(relatedProducts(all, { id: "a", categorySlug: "box" }).map((p) => p.id)).toEqual(["d", "c", "b", "e"]);
  });

  it("keeps catalog order when the product has no category", () => {
    expect(relatedProducts(all, { id: "e", categorySlug: null }, 3).map((p) => p.id)).toEqual(["a", "b", "d"]);
  });

  it("returns nothing when the catalog has only this product", () => {
    expect(relatedProducts([card("a", "box")], { id: "a", categorySlug: "box" })).toEqual([]);
  });
});
