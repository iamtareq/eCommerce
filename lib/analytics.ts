"use client";

/**
 * Analytics events. Sends to Google Analytics 4 (gtag) and Meta Pixel (fbq)
 * when their IDs are configured; otherwise does nothing.
 *
 * Tracked: page view (PageViewTracker), hero CTA click, order form started,
 * order form submitted, order success (purchase).
 *
 * Order pages (/order/<token>) are secret links that show the customer's name and
 * address, so their URL must never reach either tool. Analytics never loads the
 * trackers on them; if they are ever present anyway, Meta gets nothing from those
 * pages and GA gets /order/redacted as the page location.
 */

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
  }
}

const PRIVATE_PATH = /^\/order(?:\/|$)/;

/** True for pages whose URL must not be sent to analytics. */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH.test(pathname);
}

/** A URL that is safe to send: our own order links become /order/redacted; other sites' URLs pass through. */
export function safeUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin === window.location.origin && isPrivatePath(parsed.pathname)) return `${parsed.origin}/order/redacted`;
    return url;
  } catch {
    return "";
  }
}

export type AnalyticsEvent =
  | { name: "hero_cta_click"; location: string; product?: string }
  | { name: "view_product"; product: string; value: number }
  | { name: "add_to_cart"; product: string; value: number; quantity: number }
  | { name: "order_form_started"; value?: number }
  | { name: "order_form_submitted"; value: number; itemCount: number }
  | { name: "order_success"; orderNumber: string; value: number; itemCount: number };

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    const hidden = isPrivatePath(window.location.pathname);
    // Meta sends the page URL with every event and it cannot be overridden: nothing goes to it from order pages.
    const fbq = hidden ? undefined : window.fbq;
    const ga = window.gtag;
    const page = hidden ? { page_location: safeUrl(window.location.href), page_referrer: safeUrl(document.referrer) } : {};
    const gtag = ga && ((command: string, name: string, params: Record<string, unknown>) => ga(command, name, { ...params, ...page }));
    switch (event.name) {
      case "hero_cta_click":
        gtag?.("event", "hero_cta_click", { cta_location: event.location, product: event.product });
        fbq?.("trackCustom", "HeroCTAClick", { location: event.location });
        break;
      case "view_product":
        gtag?.("event", "view_item", { currency: "BDT", value: event.value, items: [{ item_name: event.product }] });
        fbq?.("track", "ViewContent", { content_name: event.product, value: event.value, currency: "BDT" });
        break;
      case "add_to_cart":
        gtag?.("event", "add_to_cart", {
          currency: "BDT",
          value: event.value,
          items: [{ item_name: event.product, quantity: event.quantity }],
        });
        fbq?.("track", "AddToCart", { content_name: event.product, value: event.value, currency: "BDT" });
        break;
      case "order_form_started":
        gtag?.("event", "begin_checkout", { currency: "BDT", value: event.value });
        fbq?.("track", "InitiateCheckout", { value: event.value, currency: "BDT" });
        break;
      case "order_form_submitted":
        gtag?.("event", "order_form_submitted", { currency: "BDT", value: event.value, items_count: event.itemCount });
        fbq?.("trackCustom", "OrderFormSubmitted", { value: event.value, currency: "BDT" });
        break;
      case "order_success":
        gtag?.("event", "purchase", { transaction_id: event.orderNumber, currency: "BDT", value: event.value });
        // eventID lets Meta de-duplicate if the Conversions API is added later.
        fbq?.("track", "Purchase", { value: event.value, currency: "BDT", num_items: event.itemCount }, { eventID: event.orderNumber });
        break;
    }
  } catch {
    // Analytics must never break the page.
  }
}
