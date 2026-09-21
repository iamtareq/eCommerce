"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isPrivatePath, safeUrl } from "@/lib/analytics";

/**
 * Sends page views to GA4 and Meta Pixel, on the first load and after every
 * client-side navigation. Their own automatic page views are switched off (see
 * Analytics). Order links (/order/<token>) are secret, and Analytics never loads the
 * trackers on them; as a second line of defence, order pages send no page view here,
 * GA's other events there get /order/redacted as the location, and links out of
 * them only pass our origin as the referrer.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const hidden = isPrivatePath(pathname);

  useEffect(() => {
    const href = window.location.href;
    if (previous.current === href) return; // Strict Mode runs effects twice in development.
    const page = {
      page_location: safeUrl(href),
      page_referrer: safeUrl(previous.current ?? document.referrer),
    };
    previous.current = href;
    try {
      const { gtag, fbq } = window;
      // Sticky, so GA's automatic events (scroll, outbound click, engagement) use it too.
      gtag?.("set", page);
      if (hidden) return;
      gtag?.("event", "page_view", page);
      fbq?.("track", "PageView");
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname, hidden]);

  // React places this in <head>. The Referrer-Policy header covers direct loads (next.config.ts).
  return hidden ? <meta name="referrer" content="strict-origin" /> : null;
}
