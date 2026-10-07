import type { Metadata } from "next";
import { Ornament } from "@/components/store/SectionHeading";
import { Icon } from "@/components/ui/Icon";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = {
  title: "অর্ডার ট্র্যাক করুন",
  description: "অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে আপনার Deenbox অর্ডারের অবস্থা দেখুন।",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <section className="bg-sand py-10 sm:py-16">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-8">
          <Ornament className="mb-3" />
          <h1 className="text-center text-[1.6rem] font-semibold text-pine-900 sm:text-[1.9rem]">অর্ডার ট্র্যাক করুন</h1>
          <p className="mt-2 mb-6 text-center text-muted">অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে আপনার অর্ডারের অবস্থা দেখুন।</p>
          <TrackForm />
        </div>
        <p className="mt-5 flex items-start gap-2 text-sm text-muted">
          <Icon name="info" className="mt-0.5 size-4.5 shrink-0" />
          অর্ডার নম্বরটি অর্ডার করার পর দেখানো পেজে ছিল। খুঁজে না পেলে আমাদের ফেসবুক পেজে মেসেজ দিন।
        </p>
      </div>
    </section>
  );
}
