"use client";

import { useState, useTransition } from "react";
import { abtn } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { deleteLead, setLeadContacted } from "./actions";

export function LeadActions({ id, contacted, name }: { id: string; contacted: boolean; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await action();
      setError(r.ok ? null : (r.error ?? "Failed"));
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setLeadContacted(id, !contacted))}
        className={cn(contacted ? abtn.secondary : abtn.primary, abtn.sm)}
      >
        <Icon name={contacted ? "refresh" : "check"} className="size-4" />
        {contacted ? "Not contacted" : "Mark contacted"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Remove the incomplete order from ${name || "this number"}?`)) run(() => deleteLead(id));
        }}
        className={cn(abtn.ghost, abtn.sm, "text-danger-700")}
        aria-label={`Remove the incomplete order from ${name || "this number"}`}
      >
        <Icon name="trash" className="size-4" /> Remove
      </button>
      {error && <span className="text-sm text-danger-700">{error}</span>}
    </div>
  );
}
