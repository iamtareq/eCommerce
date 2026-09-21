"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { abtn } from "./ui";

export function SyncPendingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/orders/sync-pending", { method: "POST" });
      const data = (await res.json()) as { processed?: number; synced?: number; failed?: number; notConfigured?: boolean; error?: string };
      if (!res.ok) setMessage(data.error ?? "Sync failed");
      else if (data.notConfigured) setMessage("Google Sheets is not configured.");
      else setMessage(`Processed ${data.processed}: ${data.synced} synced, ${data.failed} failed.`);
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {message && <span className="text-xs text-muted" role="status">{message}</span>}
      <button type="button" onClick={run} disabled={busy} className={`${abtn.secondary} ${abtn.md}`}>
        <Icon name="refresh" className={`size-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Syncing…" : "Sync pending to Sheet"}
      </button>
    </span>
  );
}
