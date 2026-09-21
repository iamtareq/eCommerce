"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { ORDER_STATUSES } from "@/config/order";
import type { OrderStatus } from "@/generated/prisma/enums";
import { abtn, ainput, atextarea, Notice } from "./ui";

async function patchOrder(id: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "Update failed";
  } catch {
    return "Network error";
  }
}

export function StatusChanger({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (value === "CANCELLED" && !window.confirm("Cancel this order? Stock and coupon usage will be returned.")) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const err = await patchOrder(orderId, { status: value });
    setBusy(false);
    if (err) setError(err);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="order-status" className="sr-only">
          Order status
        </label>
        <select
          id="order-status"
          value={value}
          onChange={(e) => {
            setValue(e.target.value as OrderStatus);
            setSaved(false);
          }}
          className={ainput}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={save} disabled={busy || value === status} className={`${abtn.primary} ${abtn.md}`}>
          {busy ? "Saving…" : "Update"}
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && !error && <Notice tone="success">Status updated. The Google Sheet row will be updated too.</Notice>}
    </div>
  );
}

export function AdminNoteEditor({ orderId, note }: { orderId: string; note: string }) {
  const router = useRouter();
  const [value, setValue] = useState(note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // Stays true until the refreshed `note` arrives, so the button can't log the same note twice.
  const [refreshing, startRefresh] = useTransition();
  // The server stores the note trimmed, so compare (and save) the trimmed text.
  const clean = value.trim();
  return (
    <div className="space-y-2">
      <label htmlFor="admin-note" className="sr-only">
        Internal note
      </label>
      <textarea
        id="admin-note"
        rows={3}
        value={value}
        maxLength={2000}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Called twice, no answer. Try again after 5pm."
        className={atextarea}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Visible to admins only.</span>
        <button
          type="button"
          disabled={busy || refreshing || clean === note}
          onClick={async () => {
            setBusy(true);
            const err = await patchOrder(orderId, { adminNote: clean });
            setBusy(false);
            setMessage(err ? { tone: "error", text: err } : { tone: "success", text: "Note saved." });
            if (!err) {
              // Drop the surrounding whitespace the server trimmed (unless the admin kept typing meanwhile).
              setValue((current) => (current.trim() === clean ? clean : current));
              startRefresh(() => router.refresh());
            }
          }}
          className={`${abtn.secondary} ${abtn.sm}`}
        >
          {busy || refreshing ? "Saving…" : "Save note"}
        </button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}

export function SyncRetryButton({ orderId, synced }: { orderId: string; synced: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            const res = await fetch(`/api/orders/${orderId}/sync-google-sheet`, { method: "POST" });
            const data = (await res.json()) as { outcome?: string; error?: string | null };
            const text: Record<string, [ "success" | "error" | "info", string ]> = {
              synced: ["success", "Synced to Google Sheet."],
              "up-to-date": ["info", "Already up to date — nothing to do."],
              busy: ["info", "The order changed or another sync is running. Try again in a moment."],
              "not-configured": ["error", "Google Sheets is not configured."],
              failed: ["error", `Sync failed: ${data.error ?? "unknown error"}`],
            };
            const [tone, msg] = text[data.outcome ?? ""] ?? ["error", data.error ?? "Sync failed"];
            setMessage({ tone, text: msg });
            router.refresh();
          } catch {
            setMessage({ tone: "error", text: "Network error" });
          } finally {
            setBusy(false);
          }
        }}
        className={`${abtn.secondary} ${abtn.sm}`}
      >
        <Icon name="refresh" className={`size-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Syncing…" : synced ? "Re-check sync" : "Retry sync"}
      </button>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}
