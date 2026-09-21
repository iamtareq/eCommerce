import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Icon } from "@/components/ui/Icon";
import { telUrl, whatsappUrl } from "@/lib/contact";
import { toBanglaDigits } from "@/lib/phone";
import type { SiteSettings } from "@/lib/settings";
import { Logo } from "./Logo";

export function Footer({ settings }: { settings: SiteSettings }) {
  const phone = settings.contactPhone ? telUrl(settings.contactPhone) : null;
  const wa = settings.whatsappNumber ? whatsappUrl(settings.whatsappNumber) : null;
  const year = toBanglaDigits(new Date().getFullYear());
  return (
    <footer className="bg-girih-light bg-pine-950 text-pine-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-[0.95rem] leading-7 text-pine-100/85">{siteConfig.description}</p>
        </div>

        <div>
          <h2 className="font-sans text-base font-semibold text-white">যোগাযোগ</h2>
          <ul className="mt-4 space-y-3 text-[0.95rem]">
            {phone && (
              <li>
                <a href={phone} className="inline-flex items-center gap-2.5 hover:text-white">
                  <Icon name="phone" className="size-4.5 text-brass-300" />
                  {toBanglaDigits(settings.contactPhone)}
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 hover:text-white">
                  <Icon name="whatsapp" className="size-4.5 text-brass-300" />
                  হোয়াটসঅ্যাপ
                </a>
              </li>
            )}
            {settings.messengerUrl && (
              <li>
                <a href={settings.messengerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 hover:text-white">
                  <Icon name="messenger" className="size-4.5 text-brass-300" />
                  মেসেঞ্জার
                </a>
              </li>
            )}
            {settings.facebookPageUrl && (
              <li>
                <a href={settings.facebookPageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 hover:text-white">
                  <Icon name="facebook" className="size-4.5 text-brass-300" />
                  ফেসবুক পেজ
                </a>
              </li>
            )}
            {settings.businessAddress && (
              <li className="flex items-start gap-2.5">
                <Icon name="mapPin" className="mt-1 size-4.5 shrink-0 text-brass-300" />
                <span>{settings.businessAddress}</span>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-base font-semibold text-white">দরকারি লিংক</h2>
          <ul className="mt-4 space-y-3 text-[0.95rem]">
            <li>
              <Link href="/products" className="hover:text-white">
                সকল পণ্য
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:text-white">
                আমার কার্ট
              </Link>
            </li>
            {settings.returnPolicy && (
              <li>
                <Link href="/policy" className="hover:text-white">
                  রিটার্ন ও এক্সচেঞ্জ নীতি
                </Link>
              </li>
            )}
          </ul>
          <p className="mt-6 flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm text-pine-100/90">
            <Icon name="phone" className="mt-0.5 size-4 shrink-0 text-brass-300" />
            প্রতিটি অর্ডার আমাদের প্রতিনিধি ফোন করে কনফার্ম করেন।
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-pine-100/70 sm:px-6">
          © {year} {siteConfig.name}। সর্বস্বত্ব সংরক্ষিত।
        </p>
      </div>
    </footer>
  );
}
