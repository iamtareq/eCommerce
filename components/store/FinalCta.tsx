import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { Ornament } from "./SectionHeading";

export function FinalCta({ href, facebookUrl }: { href: string; facebookUrl: string }) {
  return (
    <section aria-labelledby="final-cta-title" className="bg-girih-light bg-pine-900 py-14 text-center sm:py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Ornament tone="light" className="mb-4" />
        <h2 id="final-cta-title" className="text-balance text-[1.7rem] font-semibold text-white sm:text-[2.2rem]">
          আজই আপনার অর্ডারটি কনফার্ম করুন
        </h2>
        <p className="mt-3 text-pine-100">অর্ডার করতে এক মিনিটও লাগবে না — বাকিটা ফোনে কনফার্ম করে নেব আমরা।</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={href} className={cn(btn.light, btn.size.xl, "sm:px-10")}>
            অর্ডার করুন
            <Icon name="arrowRight" className="size-5" />
          </a>
          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(btn.size.xl, "inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 font-semibold text-white hover:bg-white/10")}
            >
              <Icon name="facebook" className="size-5" />
              ফেসবুক পেজ দেখুন
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
