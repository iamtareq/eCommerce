"use client";

import { useActionState } from "react";
import { OrderProgress } from "@/components/store/OrderProgress";
import { Icon } from "@/components/ui/Icon";
import { btn, field } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { formatDateBn } from "@/lib/dates";
import { formatTakaBn } from "@/lib/money";
import type { TrackedOrder } from "@/lib/orders/public";
import { toBanglaDigits } from "@/lib/phone";
import { trackOrderAction, type TrackState } from "./actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrderAction, null);
  return (
    <>
      {state?.order && <TrackedOrderCard order={state.order} />}
      <form action={action} className="space-y-4" noValidate>
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger-600/30 bg-danger-50 p-3 text-[0.95rem] font-medium text-danger-700">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
            {state.error}
          </p>
        )}
        <div>
          <label htmlFor="orderNumber" className={field.label}>
            অর্ডার নম্বর
          </label>
          {/* React resets the form after every action; default values keep what was typed after a failed lookup. */}
          <input
            id="orderNumber"
            name="orderNumber"
            defaultValue={state?.orderNumber ?? ""}
            placeholder="যেমন: DBX-20261007-0001"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={40}
            required
            className={cn(field.input, "font-mono")}
          />
        </div>
        <div>
          <label htmlFor="phone" className={field.label}>
            মোবাইল নম্বর
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={state?.phone ?? ""}
            placeholder="01XXXXXXXXX"
            autoComplete="tel"
            maxLength={20}
            required
            className={field.input}
          />
          <p className={field.hint}>যে নম্বর দিয়ে অর্ডার করেছিলেন</p>
        </div>
        <button type="submit" disabled={pending} className={cn(btn.primary, btn.size.lg, "w-full")}>
          <Icon name="search" className="size-5" />
          {pending ? "খোঁজা হচ্ছে…" : state?.order ? "আবার খুঁজুন" : "অর্ডার খুঁজুন"}
        </button>
      </form>
    </>
  );
}

/** The order's status and contents; nothing about who placed it or where it goes. */
function TrackedOrderCard({ order }: { order: TrackedOrder }) {
  return (
    <section aria-labelledby="tracked-title" aria-live="polite" className="mb-6 rounded-2xl border border-pine-200 bg-pine-50/60 p-4 sm:p-5">
      <h2 id="tracked-title" className="font-sans text-lg font-semibold text-ink">
        অর্ডার <span className="font-mono">{order.orderNumber}</span>
      </h2>
      <p className="mb-4 text-sm text-muted">{formatDateBn(new Date(order.placedAt))}</p>
      <OrderProgress status={order.status} />
      <ul className="mt-5 divide-y divide-line border-t border-line text-[0.95rem]">
        {order.items.map((i) => (
          <li key={i.label} className="flex justify-between gap-3 py-2">
            <span className="text-ink">
              {i.label} <span className="text-muted">×{toBanglaDigits(i.quantity)}</span>
            </span>
            <span className="tabular-nums">{formatTakaBn(i.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line pt-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">ডেলিভারি চার্জ</dt>
          <dd className="tabular-nums">{order.deliveryCharge === 0 ? "ফ্রি" : formatTakaBn(order.deliveryCharge)}</dd>
        </div>
        {order.giftWrapCharge > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-soft">গিফট র‍্যাপ</dt>
            <dd className="tabular-nums">{formatTakaBn(order.giftWrapCharge)}</dd>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-soft">ছাড়</dt>
            <dd className="tabular-nums text-success-700">− {formatTakaBn(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-bold">
          <dt>সর্বমোট</dt>
          <dd className="tabular-nums text-pine-800">{formatTakaBn(order.totalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}
