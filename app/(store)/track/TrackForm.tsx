"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/Icon";
import { btn, field } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { trackOrderAction, type TrackState } from "./actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrderAction, null);
  return (
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
        {pending ? "খোঁজা হচ্ছে…" : "অর্ডার খুঁজুন"}
      </button>
    </form>
  );
}
