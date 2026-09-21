"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Fires the purchase event once per order (the checkout usually fires it first).
 * This runs on the secret order link, where Analytics does not load the trackers, so
 * it normally sends nothing and the checkout's event is the one that counts. If they
 * are ever present, track() sends it to GA only, with the page location redacted.
 */
export function SuccessTracker({ orderNumber, value, itemCount }: { orderNumber: string; value: number; itemCount: number }) {
  useEffect(() => {
    const key = `deenbox.tracked.${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return; // Without storage we cannot de-duplicate; skip rather than double count.
    }
    track({ name: "order_success", orderNumber, value, itemCount });
  }, [orderNumber, value, itemCount]);
  return null;
}
