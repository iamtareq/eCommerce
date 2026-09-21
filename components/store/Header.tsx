import Link from "next/link";
import { CartButton } from "@/components/cart/CartButton";
import { Icon } from "@/components/ui/Icon";
import { HeaderCta } from "./HeaderCta";
import { Logo } from "./Logo";

export function Header({ facebookUrl, announcement }: { facebookUrl: string; announcement: string }) {
  return (
    <>
      {announcement && (
        <div className="bg-pine-900 px-4 py-2 text-center text-sm font-medium text-brass-100">{announcement}</div>
      )}
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6">
          <Logo />
          <nav aria-label="প্রধান মেনু" className="hidden items-center gap-1 md:flex">
            <Link href="/products" className="rounded-lg px-3 py-2 text-[0.95rem] font-medium text-ink-soft hover:bg-pine-50 hover:text-pine-800">
              সকল পণ্য
            </Link>
            <a href="#faq" className="rounded-lg px-3 py-2 text-[0.95rem] font-medium text-ink-soft hover:bg-pine-50 hover:text-pine-800">
              প্রশ্নোত্তর
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {facebookUrl && (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-11 place-items-center rounded-xl text-[#1877F2] transition-colors hover:bg-pine-50"
                aria-label="ফেসবুক পেজ দেখুন (নতুন ট্যাবে খুলবে)"
              >
                <Icon name="facebook" className="size-[1.4rem]" />
              </a>
            )}
            <CartButton />
            <HeaderCta />
          </div>
        </div>
      </header>
    </>
  );
}
