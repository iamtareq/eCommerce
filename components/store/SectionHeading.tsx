import { cn } from "@/lib/cn";

/** Small brass ornament used above section titles. */
export function Ornament({ className, tone = "brass" }: { className?: string; tone?: "brass" | "light" }) {
  const color = tone === "brass" ? "text-brass-500" : "text-brass-300";
  return (
    <div className={cn("flex items-center justify-center gap-2.5", color, className)} aria-hidden="true">
      <span className="h-px w-10 bg-current opacity-60" />
      <svg viewBox="0 0 20 20" className="size-3.5">
        <g fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="5.5" y="5.5" width="9" height="9" />
          <rect x="5.5" y="5.5" width="9" height="9" transform="rotate(45 10 10)" />
        </g>
      </svg>
      <span className="h-px w-10 bg-current opacity-60" />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  tone = "dark",
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  align?: "center" | "left";
  tone?: "dark" | "light";
  id?: string;
}) {
  return (
    <div className={cn("mb-8 sm:mb-10", align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl")}>
      {align === "center" && <Ornament className="mb-3" tone={tone === "dark" ? "brass" : "light"} />}
      {eyebrow && (
        <p className={cn("mb-2 text-sm font-semibold", tone === "dark" ? "text-brass-700" : "text-brass-300")}>{eyebrow}</p>
      )}
      <h2
        id={id}
        className={cn(
          "text-balance text-[1.6rem] font-semibold sm:text-[2rem]",
          tone === "dark" ? "text-pine-900" : "text-white",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={cn("mt-3 text-[1.02rem]", tone === "dark" ? "text-muted" : "text-pine-100")}>{subtitle}</p>
      )}
    </div>
  );
}
