import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/store/Logo";
import { getCurrentAdmin } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  return (
    <main lang="en" className="bg-girih grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-lift sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-sans text-lg font-bold text-ink">Deenbox Admin</p>
            <p className="text-sm text-muted">Sign in to manage orders</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
