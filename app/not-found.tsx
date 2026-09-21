import Link from "next/link";
import { LogoMark } from "@/components/store/Logo";

export default function NotFound() {
  return (
    <main className="bg-girih grid min-h-dvh place-items-center bg-paper px-4">
      <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-soft">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 text-[1.6rem] font-semibold text-pine-900">পেজটি পাওয়া যায়নি</h1>
        <p className="mt-2 text-muted">লিংকটি সঠিক নয় অথবা পেজটি সরিয়ে ফেলা হয়েছে।</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-pine-700 px-6 font-semibold text-white hover:bg-pine-800"
        >
          হোম পেজে ফিরে যান
        </Link>
      </div>
    </main>
  );
}
