import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Deenbox Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div lang="en" className="min-h-dvh bg-[#f6f4ee]">
      <AdminNav name={admin.displayName} role={admin.role} />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
