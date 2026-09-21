import type { Metadata } from "next";
import { Checkout } from "@/components/checkout/Checkout";
import { Ornament } from "@/components/store/SectionHeading";

export const metadata: Metadata = {
  title: "অর্ডার করুন",
  robots: { index: false, follow: true },
};

export default function CheckoutPage() {
  return (
    <section id="order" aria-labelledby="checkout-title" className="bg-sand py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Ornament className="mb-3" />
          <h1 id="checkout-title" className="text-[1.7rem] font-semibold text-pine-900 sm:text-[2.1rem]">
            আপনার অর্ডার
          </h1>
          <p className="mt-2 text-muted">পণ্য ও ঠিকানা দেখে নিয়ে &ldquo;অর্ডার কনফার্ম করুন&rdquo; বাটনে চাপুন।</p>
        </div>
        <Checkout />
      </div>
    </section>
  );
}
