"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { abtn, ainput, alabel, atextarea, Card, Notice } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatTaka } from "@/lib/money";
import { deleteCoupon, saveCoupon } from "./actions";
import { COUPON_TYPE_LABELS, couponValueLabel } from "./format";
import { COUPON_TYPES, type CouponInput, type CouponTypeValue } from "./schema";

export interface CouponFormValue {
  id?: string;
  code: string;
  description: string;
  type: CouponTypeValue;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  /** Bangladesh-time `datetime-local` values, "" = not set. */
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perPhoneLimit: string;
  isActive: boolean;
}

const EMPTY_COUPON: CouponFormValue = {
  code: "",
  description: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perPhoneLimit: "",
  isActive: true,
};

const TYPE_HELP: Record<CouponTypeValue, string> = {
  PERCENT: "A percentage of the products subtotal, optionally capped.",
  FIXED: "A fixed taka amount off the products subtotal.",
  FREE_DELIVERY: "The delivery charge becomes free. No discount on products.",
};

const int = (s: string) => (s.trim() === "" ? null : Number(s));
const digits = (s: string) => s.replace(/\D/g, "");

function toInput(v: CouponFormValue): CouponInput {
  return {
    id: v.id,
    code: v.code,
    description: v.description,
    type: v.type,
    value: v.type === "FREE_DELIVERY" ? null : int(v.value),
    minOrderAmount: int(v.minOrderAmount),
    maxDiscountAmount: v.type === "PERCENT" ? int(v.maxDiscountAmount) : null,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    usageLimit: int(v.usageLimit),
    perPhoneLimit: int(v.perPhoneLimit),
    isActive: v.isActive,
  };
}

/** Plain-English summary of what the coupon does, shown beside the form. */
function summary(v: CouponFormValue): string {
  const value = int(v.value);
  const parts: string[] = [];
  if (v.type === "FREE_DELIVERY") parts.push("Free delivery");
  else if (value && value > 0) parts.push(`${couponValueLabel(v.type, value)} off`);
  else parts.push(v.type === "PERCENT" ? "…% off" : "৳… off");
  const cap = int(v.maxDiscountAmount);
  if (v.type === "PERCENT" && cap) parts.push(`up to ${formatTaka(cap)}`);
  const min = int(v.minOrderAmount);
  if (min) parts.push(`on orders of ${formatTaka(min)} or more`);
  return parts.join(", ");
}

type Result = { tone: "success" | "error"; text: string } | null;

export function CouponForm({
  initial = EMPTY_COUPON,
  usedCount = 0,
  orderCount = 0,
}: {
  initial?: CouponFormValue;
  usedCount?: number;
  orderCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [v, setV] = useState<CouponFormValue>(initial);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);

  const set = <K extends keyof CouponFormValue>(key: K, value: CouponFormValue[K]) => setV((prev) => ({ ...prev, [key]: value }));

  /**
   * Reloads the page data after a change. Right after creating, the URL still has "?saved=1", which makes
   * the page show "Coupon created." above this form's own result — drop it so that notice doesn't linger.
   */
  function reload() {
    if (searchParams.has("saved")) router.replace(pathname, { scroll: false });
    else router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await saveCoupon(toInput(v));
      if (!res.ok) {
        setResult({ tone: "error", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!v.id && res.data) {
        router.replace(`/admin/coupons/${res.data.id}?saved=1`);
        return;
      }
      // Mirror the server's normalisation (uppercase code, unused fields cleared).
      setV((prev) => ({
        ...prev,
        code: res.data?.code ?? prev.code,
        value: prev.type === "FREE_DELIVERY" ? "" : prev.value,
        maxDiscountAmount: prev.type === "PERCENT" ? prev.maxDiscountAmount : "",
      }));
      setResult({ tone: "success", text: res.message ?? "Coupon saved" });
      reload();
    });
  }

  function remove() {
    if (!v.id) return;
    const msg =
      orderCount > 0
        ? `${initial.code} was used in ${orderCount} order${orderCount === 1 ? "" : "s"}, so it will be DEACTIVATED instead of deleted (order history keeps it). Continue?`
        : `Delete the coupon ${initial.code} permanently? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setResult(null);
    const id = v.id;
    startTransition(async () => {
      const res = await deleteCoupon(id);
      if (!res.ok) {
        setResult({ tone: "error", text: res.error });
        return;
      }
      if (res.data?.deleted) {
        router.push("/admin/coupons?deleted=1");
        return;
      }
      setV((prev) => ({ ...prev, isActive: false }));
      setResult({ tone: "success", text: res.message ?? "Coupon deactivated" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      reload();
    });
  }

  const usageLimit = int(v.usageLimit);

  return (
    <form onSubmit={submit} className="space-y-4">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card title="Coupon code">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="coupon-code" className={alabel}>
                  Code *
                </label>
                <input
                  id="coupon-code"
                  value={v.code}
                  maxLength={40}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                  className={`${ainput} font-mono tracking-wide uppercase`}
                  placeholder="EID10"
                  aria-describedby="coupon-code-help"
                />
                <p id="coupon-code-help" className="mt-1 text-xs text-muted">
                  3–40 characters: A–Z, 0–9, dash or underscore. Customers type this at checkout.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="coupon-description" className={alabel}>
                  Description (internal note)
                </label>
                <textarea
                  id="coupon-description"
                  rows={2}
                  maxLength={300}
                  value={v.description}
                  onChange={(e) => set("description", e.target.value)}
                  className={atextarea}
                  placeholder="e.g. Eid campaign for Facebook followers"
                />
              </div>
            </div>
          </Card>

          <Card title="Discount">
            <div className="space-y-4">
              <fieldset>
                <legend className={alabel}>Type *</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {COUPON_TYPES.map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                        v.type === t ? "border-pine-600 bg-pine-50" : "border-line-strong bg-white hover:border-pine-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="coupon-type"
                        value={t}
                        checked={v.type === t}
                        onChange={() => set("type", t)}
                        className="mt-0.5 size-4 accent-pine-700"
                      />
                      <span>
                        <span className="block font-semibold text-ink">{COUPON_TYPE_LABELS[t]}</span>
                        <span className="block text-xs text-muted">{TYPE_HELP[t]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                {v.type !== "FREE_DELIVERY" && (
                  <div>
                    <label htmlFor="coupon-value" className={alabel}>
                      {v.type === "PERCENT" ? "Percent off (1–100) *" : "Amount off (৳) *"}
                    </label>
                    <input
                      id="coupon-value"
                      value={v.value}
                      inputMode="numeric"
                      required
                      maxLength={v.type === "PERCENT" ? 3 : 8}
                      onChange={(e) => set("value", digits(e.target.value))}
                      className={ainput}
                      placeholder={v.type === "PERCENT" ? "10" : "100"}
                    />
                  </div>
                )}
                {v.type === "PERCENT" && (
                  <div>
                    <label htmlFor="coupon-max" className={alabel}>
                      Maximum discount (৳)
                    </label>
                    <input
                      id="coupon-max"
                      value={v.maxDiscountAmount}
                      inputMode="numeric"
                      maxLength={8}
                      onChange={(e) => set("maxDiscountAmount", digits(e.target.value))}
                      className={ainput}
                      placeholder="No cap"
                      aria-describedby="coupon-max-help"
                    />
                    <p id="coupon-max-help" className="mt-1 text-xs text-muted">
                      Optional cap on the taka discount.
                    </p>
                  </div>
                )}
                <div>
                  <label htmlFor="coupon-min" className={alabel}>
                    Minimum order (৳)
                  </label>
                  <input
                    id="coupon-min"
                    value={v.minOrderAmount}
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(e) => set("minOrderAmount", digits(e.target.value))}
                    className={ainput}
                    placeholder="No minimum"
                    aria-describedby="coupon-min-help"
                  />
                  <p id="coupon-min-help" className="mt-1 text-xs text-muted">
                    Products subtotal (after quantity discounts) needed to use the code.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Schedule & limits">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField id="coupon-starts" label="Starts" value={v.startsAt} onChange={(x) => set("startsAt", x)} emptyHint="Starts immediately" />
              <DateTimeField id="coupon-ends" label="Ends" value={v.endsAt} onChange={(x) => set("endsAt", x)} emptyHint="Never expires" />
              <p className="-mt-2 text-xs text-muted sm:col-span-2">All times are Bangladesh time (GMT+6).</p>
              <div>
                <label htmlFor="coupon-usage" className={alabel}>
                  Total uses allowed
                </label>
                <input
                  id="coupon-usage"
                  value={v.usageLimit}
                  inputMode="numeric"
                  maxLength={7}
                  onChange={(e) => set("usageLimit", digits(e.target.value))}
                  className={ainput}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label htmlFor="coupon-per-phone" className={alabel}>
                  Uses per phone number
                </label>
                <input
                  id="coupon-per-phone"
                  value={v.perPhoneLimit}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => set("perPhoneLimit", digits(e.target.value))}
                  className={ainput}
                  placeholder="Unlimited"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <div className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="mt-0.5 size-4 accent-pine-700" />
                <span>
                  <span className="block font-semibold text-ink">Active</span>
                  Customers can use this code (within the dates and limits).
                </span>
              </label>
              <div className="rounded-lg bg-paper px-3 py-2.5 text-sm">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Summary</p>
                <p className="mt-0.5 font-semibold text-ink">{summary(v)}</p>
              </div>
              {v.id && (
                <div className="rounded-lg bg-paper px-3 py-2.5 text-sm">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">Times used</p>
                  <p className="mt-0.5 font-semibold text-ink tabular-nums">
                    {usedCount}
                    {usageLimit ? ` of ${usageLimit}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Counted automatically from orders (cancelled orders give the use back).</p>
                </div>
              )}
            </div>
          </Card>

          <div className="sticky top-4 space-y-2 rounded-xl border border-line bg-white p-4 shadow-soft">
            <button type="submit" disabled={pending} className={`${abtn.primary} h-11 w-full text-base`}>
              {pending ? "Saving…" : v.id ? "Save changes" : "Create coupon"}
            </button>
            {v.id && (
              <button type="button" onClick={remove} disabled={pending} className={`${abtn.danger} ${abtn.md} w-full`}>
                <Icon name="trash" className="size-4" /> {orderCount > 0 ? "Deactivate coupon" : "Delete coupon"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function DateTimeField({
  id,
  label,
  value,
  onChange,
  emptyHint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyHint: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={alabel}>
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className={ainput} aria-describedby={`${id}-help`} />
        {value && (
          <button type="button" onClick={() => onChange("")} className={`${abtn.ghost} h-10 px-2.5`} aria-label={`Clear ${label.toLowerCase()} date`}>
            <Icon name="x" className="size-4" />
          </button>
        )}
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs text-muted">
        {value ? "Clear to remove this limit." : `Empty = ${emptyHint.toLowerCase()}.`}
      </p>
    </div>
  );
}
