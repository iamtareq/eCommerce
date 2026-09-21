"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function CopyButton({ value, label = "কপি করুন" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable (older browsers / insecure context).
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-pine-800 hover:border-pine-700"
      aria-live="polite"
    >
      <Icon name={copied ? "check" : "copy"} className="size-4" />
      {copied ? "কপি হয়েছে" : label}
    </button>
  );
}
