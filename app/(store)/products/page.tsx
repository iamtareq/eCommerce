import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard, productGridClass } from "@/components/store/ProductCard";
import { SectionHeading } from "@/components/store/SectionHeading";
import { Icon } from "@/components/ui/Icon";
import { getCategories, getProductCards } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "সকল পণ্য",
  description: "Deenbox-এর সকল ইসলামিক গিফট বক্স ও হোম ডেকর পণ্য দেখুন এবং সহজেই অর্ডার করুন।",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const { category } = await searchParams;
  const slug = typeof category === "string" ? category : undefined;
  const [products, categories] = await Promise.all([getProductCards(), getCategories()]);
  const active = slug ? categories.find((c) => c.slug === slug) : undefined;
  const shown = active ? products.filter((p) => p.categorySlug === active.slug) : products;

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
                  href={c.slug ? `/products?category=${encodeURIComponent(c.slug)}` : "/products"}
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
        {shown.length ? (
          <div className={productGridClass(shown.length)}>
            {shown.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
            <Icon name="gift" className="mx-auto size-10 text-pine-700" />
            <p className="mt-3 text-lg font-semibold">এই মুহূর্তে কোনো পণ্য নেই</p>
            <p className="mt-1 text-muted">শীঘ্রই নতুন পণ্য যোগ করা হবে।</p>
          </div>
        )}
      </div>
    </section>
  );
}
