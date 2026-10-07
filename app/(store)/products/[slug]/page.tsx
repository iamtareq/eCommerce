import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/product/Gallery";
import { ProductProvider, type ClientProduct } from "@/components/product/ProductContext";
import { ProductOrderSection } from "@/components/product/ProductOrderSection";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { Showcase } from "@/components/product/Showcase";
import { StickyOrderBar } from "@/components/product/StickyOrderBar";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductCard, productGridClass } from "@/components/store/ProductCard";
import { FaqSection, ReviewsSection, WhyChooseSection } from "@/components/store/Sections";
import { Ornament, SectionHeading } from "@/components/store/SectionHeading";
import { Icon } from "@/components/ui/Icon";
import { getSiteUrl } from "@/config/site";
import { getDeliveryConfig, getProduct, getProductCards, getReviews } from "@/lib/catalog";
import { resolveFaqs } from "@/lib/faq";
import { formatTakaBn } from "@/lib/money";
import { toBanglaDigits } from "@/lib/phone";
import { relatedProducts } from "@/lib/related";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(decodeURIComponent(slug));
  if (!product) return { title: "পণ্য পাওয়া যায়নি", robots: { index: false } };
  const title = product.seoTitle || product.name;
  const description = product.seoDescription || product.shortDescription || product.headline || undefined;
  const image = product.images[0];
  const imageUrl = image ? new URL(image.url, getSiteUrl()).toString() : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      url: `/products/${product.slug}`,
      images: imageUrl ? [{ url: imageUrl, width: image!.width, height: image!.height, alt: image!.alt }] : undefined,
    },
  };
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[1.02rem] leading-8 text-ink-soft">
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(decodeURIComponent(slug));
  if (!product) notFound();

  const [settings, reviews, delivery, catalog] = await Promise.all([
    getSettings(),
    getReviews(product.id),
    getDeliveryConfig(),
    getProductCards(),
  ]);
  const related = relatedProducts(catalog, { id: product.id, categorySlug: product.category?.slug ?? null });
  const faqs = resolveFaqs([...product.faqs, ...settings.faqs], delivery, settings.freeDeliveryMinAmount);
  const siteUrl = getSiteUrl();
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.inStock);

  const clientProduct: ClientProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    variantLabel: product.variantLabel,
    image: product.images[0]?.url ?? null,
    variants: product.variants,
    tiers: product.tiers,
  };

  const hasDetails =
    !!product.description ||
    product.includedItems.length > 0 ||
    product.specifications.length > 0 ||
    product.howToUse.length > 0 ||
    product.importantNotes.length > 0;

  return (
    <ProductProvider product={clientProduct}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.seoDescription || product.shortDescription || product.headline || product.name,
          image: product.images.map((i) => new URL(i.url, siteUrl).toString()),
          url: `${siteUrl}/products/${product.slug}`,
          brand: { "@type": "Brand", name: "Deenbox" },
          ...(product.category ? { category: product.category.name } : {}),
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "BDT",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: product.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }}
      />

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section id="product-hero" className="mx-auto max-w-6xl px-4 pt-5 pb-12 sm:px-6 sm:pt-8 md:pb-16">
        <nav aria-label="ব্রেডক্রাম্ব" className="mb-5 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-pine-800">
                হোম
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/products" className="hover:text-pine-800">
                পণ্য
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate font-medium text-ink-soft">
              {product.name}
            </li>
          </ol>
        </nav>
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <Gallery images={product.images} name={product.name} />
          <div>
            {product.category && (
              <Link
                href={`/products?category=${encodeURIComponent(product.category.slug)}`}
                className="text-sm font-semibold text-brass-700 hover:text-brass-800"
              >
                {product.category.name}
              </Link>
            )}
            <h1 className="mt-1 text-balance text-[1.9rem] leading-tight font-semibold text-pine-900 sm:text-[2.35rem]">
              {product.name}
            </h1>
            {product.headline && <p className="mt-3 font-display text-[1.2rem] leading-8 text-brass-800">{product.headline}</p>}
            {product.shortDescription && <p className="mt-3 text-[1.02rem] leading-8 text-muted">{product.shortDescription}</p>}
            <div className="my-6 h-px bg-line" />
            <PurchasePanel />
            <ul className="mt-6 grid gap-2.5 rounded-card border border-line bg-surface p-4 text-[0.95rem] text-ink-soft">
              <li className="flex items-start gap-2.5">
                <Icon name="phone" className="mt-0.5 size-5 shrink-0 text-pine-700" />
                অর্ডারের পর আমাদের প্রতিনিধি ফোন করে কনফার্ম করবেন
              </li>
              {settings.cashOnDelivery && (
                <li className="flex items-start gap-2.5">
                  <Icon name="banknote" className="mt-0.5 size-5 shrink-0 text-pine-700" />
                  ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা পরিশোধ করুন
                </li>
              )}
              {delivery.zones.length > 0 && (
                <li className="flex items-start gap-2.5">
                  <Icon name="truck" className="mt-0.5 size-5 shrink-0 text-pine-700" />
                  <span>
                    ডেলিভারি চার্জ:{" "}
                    {delivery.zones.map((z, i) => (
                      <span key={z.id}>
                        {i > 0 && " · "}
                        {z.name} {formatTakaBn(z.charge)}
                      </span>
                    ))}
                  </span>
                </li>
              )}
              {settings.freeDeliveryMinAmount && (
                <li className="flex items-start gap-2.5">
                  <Icon name="gift" className="mt-0.5 size-5 shrink-0 text-pine-700" />
                  {formatTakaBn(settings.freeDeliveryMinAmount)} বা তার বেশি অর্ডারে ডেলিভারি ফ্রি
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Benefits ─────────────────────────────────────── */}
      {product.benefits.length > 0 && (
        <section aria-labelledby="benefits-title" className="bg-sand py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="benefits-title" title="কেন এই পণ্যটি বেছে নেবেন" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.benefits.map((b) => (
                <li key={b.title} className="flex gap-4 rounded-card border border-line bg-surface p-5 shadow-soft">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
                    <Icon name="checkCircle" className="size-5.5" />
                  </span>
                  <span>
                    <h3 className="font-sans text-[1.05rem] font-semibold text-ink">{b.title}</h3>
                    {b.description && <p className="mt-1 text-[0.95rem] leading-7 text-muted">{b.description}</p>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ─── Details ──────────────────────────────────────── */}
      {hasDetails && (
        <section aria-labelledby="details-title" className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="details-title" title="পণ্যের বিস্তারিত" />
            <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
              <div className="space-y-8">
                {product.description && <Paragraphs text={product.description} />}
                {product.howToUse.length > 0 && (
                  <div>
                    <h3 className="font-sans text-lg font-semibold text-pine-900">ব্যবহারবিধি</h3>
                    <ol className="mt-4 space-y-3">
                      {product.howToUse.map((step, i) => (
                        <li key={i} className="flex gap-3 text-[0.98rem] leading-7 text-ink-soft">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brass-100 text-sm font-bold text-brass-800">
                            {toBanglaDigits(i + 1)}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <div className="space-y-5">
                {product.includedItems.length > 0 && (
                  <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
                    <h3 className="flex items-center gap-2 font-sans text-lg font-semibold text-pine-900">
                      <Icon name="package" className="size-5 text-brass-600" /> প্যাকেজে যা থাকছে
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {product.includedItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[0.98rem] text-ink-soft">
                          <Icon name="check" className="mt-1 size-4 shrink-0 text-pine-700" strokeWidth={2.5} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {product.specifications.length > 0 && (
                  <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
                    <h3 className="border-b border-line px-5 py-3.5 font-sans text-lg font-semibold text-pine-900">স্পেসিফিকেশন</h3>
                    <table className="w-full text-left text-[0.95rem]">
                      <tbody className="divide-y divide-line">
                        {product.specifications.map((s, i) => (
                          <tr key={i}>
                            <th scope="row" className="w-2/5 bg-paper px-5 py-3 font-medium text-muted">
                              {s.label}
                            </th>
                            <td className="px-5 py-3 text-ink">{s.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {product.importantNotes.length > 0 && (
                  <div className="rounded-card border border-brass-300 bg-brass-50 p-5">
                    <h3 className="flex items-center gap-2 font-sans text-lg font-semibold text-brass-800">
                      <Icon name="info" className="size-5" /> গুরুত্বপূর্ণ তথ্য
                    </h3>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-7 text-ink-soft marker:text-brass-600">
                      {product.importantNotes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Showcase ─────────────────────────────────────── */}
      {product.images.length > 1 && (
        <section aria-labelledby="showcase-title" className={hasDetails ? "bg-sand py-14 sm:py-20" : "py-14 sm:py-20"}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="showcase-title" title="ছবিতে দেখুন" subtitle="যেকোনো ছবিতে চাপ দিয়ে বড় করে দেখুন" />
            <Showcase images={product.images} name={product.name} />
          </div>
        </section>
      )}

      <WhyChooseSection items={settings.whyChoose} />
      <ReviewsSection reviews={reviews} />
      <FaqSection items={faqs} />

      {/* ─── Order ────────────────────────────────────────── */}
      <section id="order" aria-labelledby="order-title" className="scroll-mt-16 border-t border-line bg-sand py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Ornament className="mb-3" />
            <h2 id="order-title" className="text-balance text-[1.6rem] font-semibold text-pine-900 sm:text-[2rem]">
              আজই আপনার অর্ডারটি কনফার্ম করুন
            </h2>
            <p className="mt-2 text-muted">নিচের তথ্যগুলো দিয়ে &ldquo;অর্ডার কনফার্ম করুন&rdquo; বাটনে চাপুন।</p>
          </div>
          {inStock ? (
            <ProductOrderSection />
          ) : (
            <p className="mx-auto max-w-md rounded-card border border-line bg-surface p-6 text-center font-semibold text-ink-soft">
              দুঃখিত, এই পণ্যটির স্টক এই মুহূর্তে শেষ।{" "}
              <Link href="/products" className="text-pine-700 underline">
                অন্য পণ্য দেখুন
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ─── Related ──────────────────────────────────────── */}
      {related.length > 0 && (
        <section aria-labelledby="related-title" className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="related-title" title="এগুলোও দেখতে পারেন" subtitle="আপনার পছন্দ হতে পারে এমন আরও কিছু পণ্য" />
            <div className={productGridClass(related.length)}>
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <StickyOrderBar />
      {/* Room for the mobile sticky bar so it never covers the footer. */}
      <div className={related.length ? "h-20 md:hidden" : "h-20 bg-sand md:hidden"} aria-hidden="true" />
    </ProductProvider>
  );
}
