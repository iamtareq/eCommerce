import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/** Brand mark: an eight-point star in brass on a pine tile, with the wordmark. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0e4536" />
      <g fill="none" stroke="#dcc393" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="12.5" y="12.5" width="15" height="15" />
        <rect x="12.5" y="12.5" width="15" height="15" transform="rotate(45 20 20)" />
      </g>
      <circle cx="20" cy="20" r="2.6" fill="#dcc393" />
    </svg>
  );
}

export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 rounded-lg", className)} aria-label={`${siteConfig.name} — হোম`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.35rem] font-semibold tracking-tight",
            tone === "dark" ? "text-pine-900" : "text-white",
          )}
        >
          {siteConfig.name}
        </span>
        <span className={cn("mt-1 text-[0.7rem] font-medium whitespace-nowrap", tone === "dark" ? "text-brass-700" : "text-brass-300")}>
          {siteConfig.tagline}
        </span>
      </span>
    </Link>
  );
}
