"use client";

import { useState, useTransition } from "react";
import { abtn, ainput, alabel, Notice } from "@/components/admin/ui";
import { saveZone } from "./actions";
import type { ZoneView } from "./DeliveryManager";

interface ZoneFormValue {
  name: string;
  charge: string;
  estimatedDelivery: string;
  sortOrder: string;
  isDefault: boolean;
}

/** Create/edit form for a delivery zone. */
export function ZoneForm({
  zone,
  isFirstZone = false,
  nextSortOrder = 0,
  onSaved,
  onCancel,
}: {
  zone?: ZoneView;
  /** No zones exist yet: the new zone becomes the default automatically. */
  isFirstZone?: boolean;
  nextSortOrder?: number;
  onSaved: (message: string, id: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ZoneFormValue>(() => ({
    name: zone?.name ?? "",
    charge: zone ? String(zone.charge) : "",
    estimatedDelivery: zone?.estimatedDelivery ?? "",
    sortOrder: String(zone?.sortOrder ?? nextSortOrder),
    isDefault: zone?.isDefault ?? isFirstZone,
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ZoneFormValue>(key: K, value: ZoneFormValue[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const prefix = zone ? `zone-${zone.id}` : "zone-new";
  const lockedDefault = !!zone?.isDefault || isFirstZone;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveZone({
        id: zone?.id,
        name: v.name,
        charge: v.charge,
        estimatedDelivery: v.estimatedDelivery,
        sortOrder: v.sortOrder.trim() === "" ? 0 : v.sortOrder,
        isDefault: v.isDefault,
      });
      if (!res.ok) setError(res.error);
      else onSaved(res.message ?? "Zone saved", res.data?.id ?? zone?.id ?? "");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-name`} className={alabel}>
            Zone name (Bangla, shown to customers) *
          </label>
          <input
            id={`${prefix}-name`}
            value={v.name}
            maxLength={60}
            required
            onChange={(e) => set("name", e.target.value)}
            className={ainput}
            placeholder="e.g. ঢাকা সিটির ভেতরে"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-charge`} className={alabel}>
            Delivery charge ৳ *
          </label>
          <input
            id={`${prefix}-charge`}
            value={v.charge}
            inputMode="numeric"
            required
            maxLength={6}
            onChange={(e) => set("charge", e.target.value.replace(/\D/g, ""))}
            className={ainput}
            placeholder="e.g. 70"
          />
          <p className="mt-1 text-xs text-muted">Whole taka. 0 = free delivery for this zone.</p>
        </div>
        <div>
          <label htmlFor={`${prefix}-eta`} className={alabel}>
            Estimated delivery time (Bangla)
          </label>
          <input
            id={`${prefix}-eta`}
            value={v.estimatedDelivery}
            maxLength={60}
            onChange={(e) => set("estimatedDelivery", e.target.value)}
            className={ainput}
            placeholder="e.g. ১–২ দিন"
          />
          <p className="mt-1 text-xs text-muted">Optional. Shown at checkout and in the FAQ.</p>
        </div>
        <div>
          <label htmlFor={`${prefix}-sort`} className={alabel}>
            Sort order
          </label>
          <input
            id={`${prefix}-sort`}
            value={v.sortOrder}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => set("sortOrder", e.target.value.replace(/[^\d-]/g, ""))}
            className={ainput}
          />
          <p className="mt-1 text-xs text-muted">Lower numbers are listed first.</p>
        </div>
        <div className="flex flex-col justify-center">
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={v.isDefault}
              disabled={lockedDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
              className="mt-0.5 size-4 accent-pine-700"
            />
            <span>
              <span className="font-semibold text-ink">Default zone</span>
              <span className="block text-xs text-muted">Used for every location that is not assigned to a zone.</span>
            </span>
          </label>
          {zone?.isDefault && <p className="mt-1 text-xs text-muted">To change the default, edit another zone and make it the default.</p>}
          {isFirstZone && <p className="mt-1 text-xs text-muted">The first zone is always the default.</p>}
          {!zone?.isDefault && !isFirstZone && v.isDefault && (
            <p className="mt-1 text-xs text-amber-800">The current default zone will stop being the default.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={`${abtn.primary} ${abtn.md}`}>
          {pending ? "Saving…" : zone ? "Save zone" : "Create zone"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
          Cancel
        </button>
      </div>
    </form>
  );
}
