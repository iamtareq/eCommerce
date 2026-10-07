import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FinalCta } from "@/components/store/FinalCta";
import { CategoryTiles, HowToOrder, TrustStrip } from "@/components/store/HomeSections";
import { HomeStickyBar } from "@/components/store/HomeStickyBar";
import { ImagePlaceholder } from "@/components/store/ImagePlaceholder";
import { JsonLd } from "@/components/store/JsonLd";
import { Price } from "@/components/store/Price";
import { ProductCard, productGridClass } from "@/components/store/ProductCard";
import { FaqSection, ReviewsSection, WhyChooseSection } from "@/components/store/Sections";
import { SectionHeading } from "@/components/store/SectionHeading";
import { TrackedLink } from "@/components/store/TrackedLink";
import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { getFacebookPageUrl, getSiteUrl, siteConfig } from "@/config/site";
import { getCategories, getDeliveryConfig, getProductCards, getReviews } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { resolveFaqs } from "@/lib/faq";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const HOME_PRODUCT_LIMIT = 8;

export default async function HomePage() {
  const [settings, products, categories, reviews, delivery] = await Promise.all([
    getSettings(),
    getProductCards(),
    getCategories(),
    getReviews(null),
    getDeliveryConfig(),
  ]);
  const facebookUrl = settings.facebookPageUrl || getFacebookPageUrl();
  const featured = products.find((p) => p.isFeatured && p.image) ?? products.find((p) => p.image) ?? products[0];
  // Two more photographed products fill out the hero on wide screens; with fewer, the hero keeps one image.
  const heroExtras = products.filter((p) => p.image && p !== featured).slice(0, 2);
  const collage = Boolean(featured?.image) && heroExtras.length === 2;
  const faqs = resolveFaqs(settings.faqs, delivery, settings.freeDeliveryMinAmount);
  const siteUrl = getSiteUrl();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: siteConfig.name,
          url: siteUrl,
          logo: `${siteUrl}/icon.svg`,
          ...(facebookUrl ? { sameAs: [facebookUrl] } : {}),
        }}
      />

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section id="home-hero" className="relative overflow-hidden">
        <div className="bg-girih pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div
          className={cn(
            "relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-14 sm:px-6 md:pt-14 md:pb-16",
            collage ? "md:grid-cols-[1fr_1.15fr]" : "md:grid-cols-[1.05fr_1fr]",
          )}
        >
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-brass-300 bg-brass-50 px-3 py-1 text-sm font-semibold text-brass-800">
              <Icon name="star8" className="size-4" /> {siteConfig.tagline}
            </p>
            <h1 className="mt-4 text-balance text-[2.1rem] leading-[1.25] font-semibold text-pine-900 sm:text-[2.8rem]">
              {settings.homeHeadline}
            </h1>
            <p className="mt-4 max-w-xl text-[1.08rem] leading-8 text-muted">{settings.homeSubheadline}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <TrackedLink href="#products" location="home_hero" className={cn(btn.primary, btn.size.xl, "sm:px-9")}>
                অর্ডার করুন
                <Icon name="arrowDown" className="size-5" />
              </TrackedLink>
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={cn(btn.outline, btn.size.xl)}>
                  <Icon name="facebook" className="size-5 text-[#1877F2]" />
                  ফেসবুক পেজ দেখুন
                </a>
              )}
            </div>
          </div>

          <div className={cn("animate-fade-up [animation-delay:120ms]", collage && "md:grid md:grid-cols-[1.45fr_1fr] md:items-center md:gap-5")}>
            <div className="relative mx-auto w-full max-w-[26rem]">
              <div className="absolute -inset-3 rounded-t-full rounded-b-[2rem] border border-brass-300/70" aria-hidden="true" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[1.5rem] border-4 border-surface bg-sand shadow-lift">
                {featured?.image ? (
                  <Image
                    src={featured.image.url}
                    alt={featured.image.alt}
                    fill
                    priority
                    sizes="(min-width: 768px) 420px, 90vw"
                    className="object-cover"
                  />
                ) : (
                  <ImagePlaceholder label="পণ্যের ছবি শীঘ্রই যোগ করা হবে" />
                )}
              </div>
              {featured && (
                <Link
                  href={`/products/${featured.slug}`}
                  className="absolute -bottom-5 left-1/2 flex w-[88%] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur hover:border-pine-600"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{featured.name}</span>
                    <Price price={featured.price} compareAtPrice={featured.compareAtPrice} from={featured.priceVaries} size="sm" />
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pine-700 text-white">
                    <Icon name="arrowRight" className="size-5" />
                  </span>
                </Link>
              )}
            </div>
            {collage && (
              <div className="hidden gap-5 md:grid">
                {heroExtras.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className="group relative block aspect-square overflow-hidden rounded-[1.5rem] border-4 border-surface bg-sand shadow-soft"
                  >
                    <Image
                      src={p.image!.url}
                      alt={p.image!.alt}
                      fill
                      sizes="240px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute inset-x-2 bottom-2 truncate rounded-xl bg-surface/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-soft">
                      {p.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <TrustStrip cashOnDelivery={settings.cashOnDelivery} freeDeliveryMinAmount={settings.freeDeliveryMinAmount} delivery={delivery} />
      <CategoryTiles categories={categories} products={products} />

      {/* ─── Products ─────────────────────────────────────── */}
      <section id="products" aria-labelledby="products-title" className="bg-sand py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="products-title" title="আমাদের পণ্যসমূহ" subtitle="পছন্দের পণ্যটি বেছে নিয়ে সহজেই অর্ডার করুন" />
          {products.length ? (
            <>
              <div className={productGridClass(Math.min(products.length, HOME_PRODUCT_LIMIT))}>
                {products.slice(0, HOME_PRODUCT_LIMIT).map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
              {products.length > HOME_PRODUCT_LIMIT && (
                <div className="mt-10 text-center">
                  <Link href="/products" className={cn(btn.outline, btn.size.lg)}>
                    সকল পণ্য দেখুন <Icon name="arrowRight" className="size-5" />
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="mx-auto max-w-md rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
              <Icon name="gift" className="mx-auto size-10 text-pine-700" />
              <p className="mt-3 text-lg font-semibold">শীঘ্রই নতুন পণ্য আসছে</p>
              <p className="mt-1 text-muted">আপডেট পেতে আমাদের ফেসবুক পেজটি ফলো করুন।</p>
            </div>
          )}
        </div>
      </section>

      <HowToOrder cashOnDelivery={settings.cashOnDelivery} />
      <WhyChooseSection items={settings.whyChoose} />
      <ReviewsSection reviews={reviews} />
      <FaqSection items={faqs} className="bg-sand" />
      <FinalCta href="#products" facebookUrl={facebookUrl} />
      <HomeStickyBar facebookUrl={facebookUrl} />
    </>
  );
}
