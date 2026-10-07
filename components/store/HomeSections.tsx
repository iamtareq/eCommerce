import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { DeliveryConfig, ProductCard } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatTakaBn } from "@/lib/money";
import { toBanglaDigits } from "@/lib/phone";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { SectionHeading } from "./SectionHeading";

interface TrustItem {
  icon: IconName;
  title: string;
  detail: string;
}

/**
 * The store's promises, right under the hero. Only facts the owner has set up are
 * shown: cash on delivery and free delivery appear once they are turned on in settings.
 */
export function TrustStrip({
  cashOnDelivery,
  freeDeliveryMinAmount,
  delivery,
}: {
  cashOnDelivery: boolean;
  freeDeliveryMinAmount: number | null;
  delivery: DeliveryConfig;
}) {
  const timed = delivery.zones.filter((z) => z.estimatedDelivery);
  const items: TrustItem[] = [
    { icon: "phone", title: "ফোনে কনফার্মেশন", detail: "অর্ডারের পর আমরাই ফোন করে কনফার্ম করি" },
    {
      icon: "truck",
      title: "ঢাকার ভেতরে ও বাইরে ডেলিভারি",
      detail: timed.length ? timed.map((z) => `${z.name}: ${z.estimatedDelivery}`).join(" · ") : "সারা দেশে হোম ডেলিভারি",
    },
  ];
  if (cashOnDelivery) items.push({ icon: "banknote", title: "ক্যাশ অন ডেলিভারি", detail: "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন" });
  if (freeDeliveryMinAmount) {
    items.push({ icon: "gift", title: "ফ্রি ডেলিভারি", detail: `${formatTakaBn(freeDeliveryMinAmount)} বা তার বেশি অর্ডারে` });
  }
  if (items.length < 4) items.push({ icon: "check", title: "সহজ অর্ডার", detail: "কোনো অ্যাকাউন্ট খুলতে হবে না" });

  return (
    <section aria-label="আমাদের সেবা" className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4", items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {items.map((item) => (
          <li
            key={item.title}
            className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3.5 shadow-soft sm:flex-row sm:items-center sm:gap-3.5 sm:p-4"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
              <Icon name={item.icon} className="size-5.5" />
            </span>
            <span className="min-w-0">
              <span className="block leading-snug font-semibold text-ink">{item.title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Large picture tiles, one per category, each showing a product from it. */
export function CategoryTiles({ categories, products }: { categories: { id: string; name: string; slug: string }[]; products: ProductCard[] }) {
  if (categories.length < 2) return null;
  const tiles = categories.map((c) => {
    const inCategory = products.filter((p) => p.categorySlug === c.slug);
    return { ...c, count: inCategory.length, image: inCategory.find((p) => p.image)?.image ?? null };
  });
  return (
    <section aria-labelledby="categories-title" className="pb-14 sm:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="categories-title" title="ক্যাটাগরি অনুযায়ী বেছে নিন" subtitle="কার জন্য, কোন উপলক্ষে — সহজে খুঁজে নিন" />
        <ul
          className={cn(
            "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-auto sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0",
            // A short list stays centred instead of hugging the left edge (as the product grid does).
            tiles.length === 2 ? "sm:max-w-3xl" : tiles.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
          )}
        >
          {tiles.map((c) => (
            <li key={c.id} className="w-[11.5rem] shrink-0 snap-start sm:w-auto">
              <Link
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="group block overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-shadow hover:shadow-lift"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-sand">
                  {c.image ? (
                    <Image
                      src={c.image.url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 270px, (min-width: 640px) 45vw, 184px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <ImagePlaceholder />
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0">
                    <span className="line-clamp-2 block font-display text-[1.05rem] leading-snug font-semibold text-pine-900">{c.name}</span>
                    <span className="block text-sm text-muted">{toBanglaDigits(c.count)}টি পণ্য</span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine-50 text-pine-700 transition-colors group-hover:bg-pine-700 group-hover:text-white">
                    <Icon name="arrowRight" className="size-4.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Three steps from choosing to delivery; the last one names cash on delivery only when it is on. */
export function HowToOrder({ cashOnDelivery }: { cashOnDelivery: boolean }) {
  const steps = [
    { title: "পণ্য বেছে নিন", detail: "পছন্দের পণ্য, সাইজ ও পরিমাণ ঠিক করুন" },
    { title: "নাম, নম্বর ও ঠিকানা দিন", detail: "কোনো অ্যাকাউন্ট খুলতে হবে না — এক মিনিটেই অর্ডার" },
    {
      title: "ফোনে কনফার্ম, ঘরে ডেলিভারি",
      detail: cashOnDelivery ? "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন" : "আমরা ফোন করে অর্ডার কনফার্ম করে পাঠিয়ে দিই",
    },
  ];
  return (
    <section aria-labelledby="how-title" className="py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeading id="how-title" title="৩ ধাপে অর্ডার" />
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 sm:flex-col sm:items-center sm:text-center">
              <span className="grid size-13 shrink-0 place-items-center rounded-full bg-pine-700 font-display text-xl font-semibold text-white shadow-[0_8px_20px_-10px_rgb(14_69_54/0.8)]">
                {toBanglaDigits(i + 1)}
              </span>
              <span>
                <span className="block text-[1.1rem] font-semibold text-ink">{s.title}</span>
                <span className="mt-1 block text-[0.98rem] text-muted">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
