/** Shared class strings for buttons and form controls (storefront). */

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export const btn = {
  primary: `${base} bg-pine-700 text-white shadow-[0_6px_16px_-8px_rgb(14_69_54/0.7)] hover:bg-pine-800`,
  brass: `${base} bg-brass-600 text-white hover:bg-brass-700`,
  outline: `${base} border border-line-strong bg-surface text-ink hover:border-pine-600 hover:text-pine-800`,
  ghost: `${base} text-pine-800 hover:bg-pine-50`,
  light: `${base} bg-white text-pine-900 hover:bg-brass-50`,
  size: {
    sm: "h-9 px-3.5 text-sm",
    md: "h-11 px-5 text-[0.95rem]",
    lg: "h-13 px-6 text-base",
    xl: "h-14 px-7 text-[1.05rem]",
  },
} as const;

export const field = {
  label: "mb-1.5 block text-[0.95rem] font-semibold text-ink-soft",
  input:
    "block h-12 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 shadow-[inset_0_1px_2px_rgb(27_36_32/0.04)] transition-colors focus:border-pine-600 focus:outline-none focus:ring-3 focus:ring-pine-600/15 aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-600/10 disabled:bg-sand",
  textarea:
    "block min-h-24 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-pine-600 focus:outline-none focus:ring-3 focus:ring-pine-600/15 aria-[invalid=true]:border-danger-600",
  error: "mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger-700",
  hint: "mt-1.5 text-sm text-muted",
} as const;
