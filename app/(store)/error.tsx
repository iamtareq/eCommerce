"use client";

import { useEffect } from "react";
import { btn } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="py-20">
      <div className="mx-auto max-w-md px-4 text-center">
        <h1 className="text-[1.6rem] font-semibold text-pine-900">দুঃখিত, একটি সমস্যা হয়েছে</h1>
        <p className="mt-2 text-muted">এই মুহূর্তে পেজটি দেখানো যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।</p>
        <button type="button" onClick={reset} className={cn(btn.primary, btn.size.lg, "mt-6")}>
          আবার চেষ্টা করুন
        </button>
      </div>
    </section>
  );
}
