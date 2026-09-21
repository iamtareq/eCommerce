import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ornament } from "@/components/store/SectionHeading";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "রিটার্ন ও এক্সচেঞ্জ নীতি",
  alternates: { canonical: "/policy" },
};

export default async function PolicyPage() {
  const settings = await getSettings();
  if (!settings.returnPolicy) notFound();
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Ornament className="mb-3" />
        <h1 className="text-center text-[1.7rem] font-semibold text-pine-900 sm:text-[2.1rem]">রিটার্ন ও এক্সচেঞ্জ নীতি</h1>
        <div className="mt-8 rounded-card border border-line bg-surface p-6 text-[1.02rem] leading-8 whitespace-pre-line text-ink-soft shadow-soft">
          {settings.returnPolicy}
        </div>
      </div>
    </section>
  );
}
