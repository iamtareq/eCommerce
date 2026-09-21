import Link from "next/link";
import type { Tone } from "@/config/order";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/** Admin UI kit — compact, neutral, English. */

// The last three classes let a button-styled <label> placed right after a visually hidden
// file input show that input's keyboard focus (the outline on the 1px input can't be seen).
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap [input[type=file]:focus-visible+&]:outline-2 [input[type=file]:focus-visible+&]:outline-offset-2 [input[type=file]:focus-visible+&]:outline-pine-600";

export const abtn = {
  primary: `${btnBase} bg-pine-700 text-white hover:bg-pine-800`,
  secondary: `${btnBase} border border-line-strong bg-white text-ink hover:border-pine-600 hover:text-pine-800`,
  danger: `${btnBase} border border-danger-600/30 bg-white text-danger-700 hover:bg-danger-50`,
  ghost: `${btnBase} text-ink-soft hover:bg-sand`,
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
} as const;

export const ainput =
  "block h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-[0.95rem] text-ink placeholder:text-muted/60 focus:border-pine-600 focus:outline-none focus:ring-2 focus:ring-pine-600/15 aria-[invalid=true]:border-danger-600 disabled:bg-sand";
export const atextarea =
  "block w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-[0.95rem] text-ink placeholder:text-muted/60 focus:border-pine-600 focus:outline-none focus:ring-2 focus:ring-pine-600/15";
export const alabel = "mb-1 block text-sm font-semibold text-ink-soft";

const TONES: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-800 ring-orange-600/20",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-600/20",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/20",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  gray: "bg-stone-100 text-stone-700 ring-stone-500/20",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-white shadow-[0_1px_2px_rgb(27_36_32/0.04)]",
        // Unpadded cards hold edge-to-edge tables/lists: clip them to the rounded corners so header and
        // row backgrounds don't paint square corners over the border. `clip` (not `hidden`) adds no scroll box.
        !padded && "overflow-clip",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          {title && <h2 className="font-sans text-[0.98rem] font-semibold text-ink">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-pine-800">
          <Icon name="chevronLeft" className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-bold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "gray", href }: { label: string; value: React.ReactNode; icon: IconName; tone?: Tone; href?: string }) {
  const body = (
    <div className="flex items-center gap-3.5 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(27_36_32/0.04)] transition-colors hover:border-line-strong">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset", TONES[tone])}>
        <Icon name={icon} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
        <span className="block text-xl font-bold text-ink tabular-nums">{value}</span>
      </span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({ icon = "info", title, children }: { icon?: IconName; title: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <Icon name={icon} className="mx-auto size-8 text-muted" />
      <p className="mt-2 font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: "border-sky-600/20 bg-sky-50 text-sky-900",
    success: "border-emerald-600/20 bg-emerald-50 text-emerald-900",
    error: "border-red-600/20 bg-red-50 text-red-900",
    warning: "border-amber-600/25 bg-amber-50 text-amber-900",
  }[tone];
  const icon: IconName = tone === "success" ? "checkCircle" : tone === "info" ? "info" : "alert";
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", styles)} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export const table = {
  // `relative` keeps absolutely-positioned children (e.g. sr-only labels) inside the scroll area.
  wrap: "relative overflow-x-auto",
  table: "w-full min-w-[640px] text-left text-sm",
  th: "border-b border-line bg-paper px-3 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
  td: "border-b border-line px-3 py-3 align-top first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
  /**
   * Row actions pinned to the right edge, so Edit/Delete stay on-screen while a wide table scrolls
   * sideways on a phone. Add `stickyTable` to the <table> (separate borders move with a sticky cell)
   * and give every <tr> an opaque background — the actions cell inherits it to cover what scrolls under
   * (an unpadded Card clips those backgrounds to its rounded corners).
   */
  stickyTable: "border-separate border-spacing-0",
  actionsTh: "sticky right-0",
  actionsTd: "sticky right-0 bg-inherit",
};
