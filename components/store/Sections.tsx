import Image from "next/image";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { ReviewInfo } from "@/lib/catalog";
import type { FaqItem } from "@/lib/validation/content";
import { SectionHeading } from "./SectionHeading";
import { Stars } from "./Stars";

const WHY_ICONS: IconName[] = ["sparkles", "phone", "truck", "shield", "gift", "package"];

export function WhyChooseSection({ items }: { items: { title: string; description: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="why-title" id="why" className="bg-sand py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="why-title" title="কেন দ্বীনবক্স?" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.title} className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <span className="grid size-11 place-items-center rounded-xl bg-pine-50 text-pine-700">
                <Icon name={WHY_ICONS[i % WHY_ICONS.length] ?? "sparkles"} className="size-5.5" />
              </span>
              <h3 className="mt-4 font-sans text-[1.05rem] font-semibold text-ink">{item.title}</h3>
              {item.description && <p className="mt-1.5 text-[0.95rem] leading-7 text-muted">{item.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ReviewsSection({ reviews }: { reviews: ReviewInfo[] }) {
  if (!reviews.length) return null;
  return (
    <section aria-labelledby="reviews-title" id="reviews" className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="reviews-title" title="গ্রাহকদের মতামত" subtitle="যাঁরা আমাদের কাছ থেকে কিনেছেন, তাঁদের কথা" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-soft">
              <Stars rating={r.rating} />
              <blockquote className="mt-3 flex-1 text-[0.98rem] leading-7 text-ink-soft">“{r.text}”</blockquote>
              {r.imageUrl && (
                <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-sand">
                  <Image src={r.imageUrl} alt={`${r.customerName}-এর রিভিউয়ের ছবি`} fill sizes="(min-width: 1024px) 340px, 90vw" className="object-cover" />
                </div>
              )}
              <footer className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pine-100 font-semibold text-pine-800" aria-hidden="true">
                  {r.customerName.trim().charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{r.customerName}</span>
                  <span className="block truncate text-sm text-muted">
                    {[r.location, r.productName].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FaqSection({ items, className = "" }: { items: FaqItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-title" id="faq" className={`py-14 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="faq-title" title="সচরাচর জিজ্ঞাসা" />
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          {items.map((item, i) => (
            <details key={`${i}-${item.question}`} className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-left font-semibold text-ink hover:bg-paper focus-visible:bg-paper">
                <span>{item.question}</span>
                <Icon name="chevronDown" className="mt-1 size-5 shrink-0 text-pine-700 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 text-[0.98rem] leading-7 whitespace-pre-line text-muted">{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
