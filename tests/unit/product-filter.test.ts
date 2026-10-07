import { describe, expect, it } from "vitest";
import type { ProductCard } from "@/lib/catalog";
import { filterProducts, parseSort } from "@/lib/product-filter";

const card = (id: string, name: string, price: number, extra: Partial<ProductCard> = {}): ProductCard => ({
  id,
  slug: id,
  name,
  shortDescription: null,
  categoryName: null,
  categorySlug: null,
  image: null,
  price,
  compareAtPrice: null,
  priceVaries: false,
  inStock: true,
  isFeatured: false,
  ...extra,
});

const all = [
  card("frame", "ক্যালিগ্রাফি ওয়াল ফ্রেম", 990, { categoryName: "হোম ডেকর" }),
  card("box", "Islamic Gift Box", 1250, { shortDescription: "ঈদের উপহার" }),
  card("tasbih", "তাসবিহ সেট", 650, { inStock: false }),
  card("mat", "জায়নামাজ", 800),
];

describe("filterProducts", () => {
  it("matches Bangla and English words in the name, description or category, ignoring case", () => {
    expect(filterProducts(all, "ফ্রেম", "").map((p) => p.id)).toEqual(["frame"]);
    expect(filterProducts(all, "gift BOX", "").map((p) => p.id)).toEqual(["box"]);
    expect(filterProducts(all, "ঈদের", "").map((p) => p.id)).toEqual(["box"]);
    expect(filterProducts(all, "হোম  ডেকর", "").map((p) => p.id)).toEqual(["frame"]);
    expect(filterProducts(all, "ফ্রেম জায়নামাজ", "")).toEqual([]);
  });

  it("sorts by price either way, with sold-out products last", () => {
    expect(filterProducts(all, "", "price-asc").map((p) => p.id)).toEqual(["mat", "frame", "box", "tasbih"]);
    expect(filterProducts(all, "", "price-desc").map((p) => p.id)).toEqual(["box", "frame", "mat", "tasbih"]);
    expect(filterProducts(all, "", "").map((p) => p.id)).toEqual(["frame", "box", "mat", "tasbih"]);
  });
});

describe("parseSort", () => {
  it("accepts known sorts only", () => {
    expect(parseSort("price-asc")).toBe("price-asc");
    expect(parseSort("drop table")).toBe("");
    expect(parseSort(undefined)).toBe("");
  });
});
