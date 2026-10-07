import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard, productGridClass } from "@/components/store/ProductCard";
import { SectionHeading } from "@/components/store/SectionHeading";
import { Icon } from "@/components/ui/Icon";
import { btn, field } from "@/components/ui/styles";
import { getCategories, getProductCards } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { toBanglaDigits } from "@/lib/phone";
import { filterProducts, parseSort, PRODUCT_SORTS } from "@/lib/product-filter";

export const metadata: Metadata = {
  title: "সকল পণ্য",
  description: "Deenbox-এর সকল ইসলামিক গিফট বক্স ও হোম ডেকর পণ্য দেখুন এবং সহজেই অর্ডার করুন।",
  alternates: { canonical: "/products" },
};

type SearchParams = { category?: string | string[]; q?: string | string[]; sort?: string | string[] };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const slug = typeof params.category === "string" ? params.category : undefined;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const sort = parseSort(params.sort);
  const [products, categories] = await Promise.all([getProductCards(), getCategories()]);
  const active = slug ? categories.find((c) => c.slug === slug) : undefined;
  const inCategory = active ? products.filter((p) => p.categorySlug === active.slug) : products;
  const shown = filterProducts(inCategory, q, sort);
  const searching = q.trim() !== "";

  /** A link that changes one filter and keeps the others. */
  const href = (change: Partial<{ category: string; q: string; sort: string }>) => {
    const next = { category: active?.slug ?? "", q, sort, ...change };
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return query ? `/products?${query}` : "/products";
  };

  return (
    <section id="products" className="py-10 sm:py-14" aria-labelledby="products-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="products-title"
          title={active ? active.name : "সকল পণ্য"}
          subtitle={active?.description || "পছন্দের পণ্যটি বেছে নিয়ে সহজেই অর্ডার করুন"}
        />
        {categories.length > 1 && (
          <nav aria-label="ক্যাটাগরি" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            {[{ id: "all", name: "সব", slug: "" }, ...categories].map((c) => {
              const isActive = (c.slug || undefined) === active?.slug;
              return (
                <Link
                  key={c.id}
                  href={href({ category: c.slug })}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
                    isActive
                      ? "border-pine-700 bg-pine-700 text-white"
                      : "border-line-strong bg-surface text-ink-soft hover:border-pine-700 hover:text-pine-800",
                  )}
                >
                  {c.name}
                </Link>
              );
            })}
          </nav>
        )}
        <form
          method="get"
          action="/products"
          role="search"
          className="mx-auto mb-8 flex max-w-3xl flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-soft sm:flex-row sm:items-center"
        >
          {active && <input type="hidden" name="category" value={active.slug} />}
          <label htmlFor="product-search" className="sr-only">
            পণ্য খুঁজুন
          </label>
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
            <input
              id="product-search"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="পণ্যের নাম লিখুন, যেমন: ওয়াল ফ্রেম"
              className={cn(field.input, "pl-11")}
            />
          </div>
          <label htmlFor="product-sort" className="sr-only">
            সাজান
          </label>
          <select id="product-sort" name="sort" defaultValue={sort} className={cn(field.input, "sm:w-52")}>
            {PRODUCT_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className={cn(btn.primary, btn.size.md, "h-12")}>
            খুঁজুন
          </button>
        </form>
        {searching && (
          <p className="mb-6 text-center text-muted" aria-live="polite">
            &ldquo;{q}&rdquo; খুঁজে {toBanglaDigits(shown.length)}টি পণ্য পাওয়া গেছে।{" "}
            <Link href={href({ q: "" })} className="font-semibold text-pine-700 underline">
              খোঁজা বাতিল করুন
            </Link>
          </p>
        )}
        {shown.length ? (
          <div className={productGridClass(shown.length)}>
            {shown.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
            <Icon name="gift" className="mx-auto size-10 text-pine-700" />
            <p className="mt-3 text-lg font-semibold">{searching ? "কোনো পণ্য পাওয়া যায়নি" : "এই মুহূর্তে কোনো পণ্য নেই"}</p>
            <p className="mt-1 text-muted">{searching ? "অন্য কোনো শব্দ দিয়ে খুঁজে দেখুন।" : "শীঘ্রই নতুন পণ্য যোগ করা হবে।"}</p>
          </div>
        )}
      </div>
    </section>
  );
}
