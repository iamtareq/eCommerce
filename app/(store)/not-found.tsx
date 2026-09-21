import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

export default function StoreNotFound() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-md px-4 text-center">
        <span className="bg-girih mx-auto grid size-20 place-items-center rounded-full bg-pine-50 text-pine-700">
          <Icon name="search" className="size-9" />
        </span>
        <h1 className="mt-5 text-[1.7rem] font-semibold text-pine-900">পেজটি পাওয়া যায়নি</h1>
        <p className="mt-2 text-muted">আপনি যে পেজটি খুঁজছেন সেটি সরিয়ে ফেলা হয়েছে অথবা লিংকটি সঠিক নয়।</p>
        <Link href="/" className={cn(btn.primary, btn.size.lg, "mt-6")}>
          হোম পেজে ফিরে যান
        </Link>
      </div>
    </section>
  );
}
