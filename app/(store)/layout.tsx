import { connection } from "next/server";
import { CartProvider } from "@/components/cart/CartProvider";
import { Analytics } from "@/components/store/Analytics";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { getFacebookPageUrl } from "@/config/site";
import { getSettings } from "@/lib/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Rendered per request (data itself is cached) so builds never need the database.
  await connection();
  const settings = await getSettings();
  const facebookUrl = settings.facebookPageUrl || getFacebookPageUrl();
  return (
    <CartProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift"
      >
        মূল অংশে যান
      </a>
      <Header facebookUrl={facebookUrl} announcement={settings.announcement} />
      <main id="main">{children}</main>
      <Footer settings={{ ...settings, facebookPageUrl: facebookUrl }} />
      <Analytics />
    </CartProvider>
  );
}
