"use client";

import { cn } from "@/lib/cn";

/** On/off switch built on a real checkbox, so it works with keyboards and screen readers. */
export function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full bg-stone-300 transition-colors peer-checked:bg-pine-700 peer-focus-visible:ring-2 peer-focus-visible:ring-pine-600/40 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
