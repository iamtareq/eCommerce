"use client";

import { track } from "@/lib/analytics";

/** An in-page CTA link that records a "hero_cta_click" event. */
export function TrackedLink({
  href,
  location,
  className,
  children,
}: {
  href: string;
  location: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className} onClick={() => track({ name: "hero_cta_click", location })}>
      {children}
    </a>
  );
}
