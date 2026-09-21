import Image from "next/image";
import Link from "next/link";
import { btn } from "@/components/ui/styles";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { DiscountBadge, Price } from "./Price";

/** Grid classes that keep a short product list centred instead of hugging the left edge. */
export function productGridClass(count: number): string {
  if (count <= 1) return "mx-auto grid max-w-sm gap-5";
  if (count === 2) return "mx-auto grid max-w-3xl gap-5 sm:grid-cols-2";
  if (count === 3) return "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
  return "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const href = `/products/${product.slug}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-shadow hover:shadow-lift">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-sand" tabIndex={-1} aria-hidden="true">
        {product.image ? (
          <Image
            src={product.image.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <ImagePlaceholder />
        )}
        <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} className="absolute top-3 left-3" />
        {!product.inStock && (
          <span className="absolute top-3 right-3 rounded-full bg-ink/80 px-2.5 py-0.5 text-[0.8rem] font-semibold text-white">
            স্টক শেষ
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {product.categoryName && <p className="text-[0.8rem] font-semibold text-brass-700">{product.categoryName}</p>}
        <h3 className="mt-1 font-display text-lg font-semibold text-pine-900">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription && <p className="mt-1.5 line-clamp-2 text-[0.95rem] text-muted">{product.shortDescription}</p>}
        <div className="mt-auto pt-4">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} from={product.priceVaries} />
          <Link
            href={`${href}#order`}
            className={cn(btn.primary, btn.size.md, "relative z-10 mt-3 w-full", !product.inStock && "pointer-events-none opacity-60")}
            aria-disabled={!product.inStock}
          >
            {product.inStock ? "অর্ডার করুন" : "স্টক শেষ"}
          </Link>
        </div>
      </div>
    </article>
  );
}
