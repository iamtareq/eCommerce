"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PairListEditor } from "@/components/admin/ListEditors";
import { abtn, ainput, alabel, atextarea, Card, Notice } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { saveSiteSettings, type SiteSettingsInput } from "./actions";
import { Toggle } from "./Toggle";

export interface SettingsFormValue {
  acceptingOrders: boolean;
  closedMessage: string;
  defaultMaxPerOrder: string;
  duplicateWindowHours: string;
  freeDeliveryMinAmount: string;
  announcement: string;
  homeHeadline: string;
  homeSubheadline: string;
  contactPhone: string;
  whatsappNumber: string;
  messengerUrl: string;
  facebookPageUrl: string;
  email: string;
  businessAddress: string;
  whyChoose: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  returnPolicy: string;
}

type TextKey = {
  [K in keyof SettingsFormValue]: SettingsFormValue[K] extends string ? K : never;
}[keyof SettingsFormValue];

const isBlankRow = (row: Record<string, string>) => Object.values(row).every((x) => !x.trim());

function toInput(v: SettingsFormValue): SiteSettingsInput {
  return {
    acceptingOrders: v.acceptingOrders,
    closedMessage: v.closedMessage,
    defaultMaxPerOrder: Number(v.defaultMaxPerOrder),
    duplicateWindowHours: Number(v.duplicateWindowHours),
    freeDeliveryMinAmount: v.freeDeliveryMinAmount.trim() === "" ? null : Number(v.freeDeliveryMinAmount),
    announcement: v.announcement,
    homeHeadline: v.homeHeadline,
    homeSubheadline: v.homeSubheadline,
    contactPhone: v.contactPhone,
    whatsappNumber: v.whatsappNumber,
    messengerUrl: v.messengerUrl,
    facebookPageUrl: v.facebookPageUrl,
    email: v.email,
    businessAddress: v.businessAddress,
    whyChoose: v.whyChoose,
    faqs: v.faqs,
    returnPolicy: v.returnPolicy,
  };
}

const SUB: Record<string, string> = { title: "title", description: "description", question: "question", answer: "answer" };

/** Errors for one list field, e.g. "faqs.2.question" → "#3 question: Required". */
function listErrors(errors: Record<string, string>, field: string): string[] {
  return Object.entries(errors)
    .filter(([key]) => key === field || key.startsWith(`${field}.`))
    .map(([key, message]) => {
      const [, index, sub] = key.split(".");
      if (index === undefined) return message;
      return `#${Number(index) + 1}${sub ? ` ${SUB[sub] ?? sub}` : ""}: ${message}`;
    });
}

export function SettingsForm({ initial }: { initial: SettingsFormValue }) {
  const router = useRouter();
  const [v, setV] = useState<SettingsFormValue>(initial);
  const [saved, setSaved] = useState<SettingsFormValue>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof SettingsFormValue>(key: K, value: SettingsFormValue[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    // Clear this field's errors (for lists: every "key.N.sub" entry).
    setErrors((prev) => {
      const stale = Object.keys(prev).filter((k) => k === key || k.startsWith(`${key}.`));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const k of stale) delete next[k];
      return next;
    });
  };

  function fail(fieldErrors: Record<string, string>, text: string) {
    setErrors(fieldErrors);
    setResult({ tone: "error", text });
    const first = Object.keys(fieldErrors)[0];
    const el = first ? document.getElementById(`s-${first}`) : null;
    if (el) el.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    // Drop completely empty list rows so the indexes in error messages match what is shown.
    const next: SettingsFormValue = {
      ...v,
      whyChoose: v.whyChoose.filter((r) => !isBlankRow(r)),
      faqs: v.faqs.filter((r) => !isBlankRow(r)),
    };
    setV(next);

    const local: Record<string, string> = {};
    if (!next.defaultMaxPerOrder.trim()) local.defaultMaxPerOrder = "Required";
    if (!next.duplicateWindowHours.trim()) local.duplicateWindowHours = "Required (use 0 to turn off)";
    if (Object.keys(local).length) {
      fail(local, "Please fill in the required ordering fields.");
      return;
    }

    startTransition(async () => {
      const res = await saveSiteSettings(toInput(next));
      if (!res.ok) {
        fail(res.fieldErrors ?? {}, res.error);
        return;
      }
      setErrors({});
      setSaved(next);
      setResult({ tone: "success", text: res.message ?? "Settings saved" });
      router.refresh();
    });
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`s-${key}-error`} className="mt-1 text-xs font-medium text-danger-700">
        {errors[key]}
      </p>
    ) : null;

  const hint = (text: React.ReactNode) => <p className="mt-1 text-xs text-muted">{text}</p>;

  /** Labelled text input / textarea bound to a string field. */
  const text = (
    key: TextKey,
    label: string,
    opts: {
      maxLength: number;
      placeholder?: string;
      help?: React.ReactNode;
      rows?: number;
      type?: "text" | "email" | "url" | "tel";
      inputMode?: "numeric" | "tel" | "email" | "url";
      digitsOnly?: boolean;
      className?: string;
    },
  ) => {
    const common = {
      id: `s-${key}`,
      value: v[key],
      maxLength: opts.maxLength,
      placeholder: opts.placeholder,
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": errors[key] ? `s-${key}-error` : undefined,
    };
    return (
      <div className={opts.className}>
        <label htmlFor={`s-${key}`} className={alabel}>
          {label}
        </label>
        {opts.rows ? (
          <textarea
            {...common}
            rows={opts.rows}
            onChange={(e) => set(key, e.target.value)}
            className={cn(atextarea, errors[key] && "border-danger-600")}
          />
        ) : (
          <input
            {...common}
            type={opts.type ?? "text"}
            inputMode={opts.inputMode}
            onChange={(e) => set(key, opts.digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value)}
            className={ainput}
          />
        )}
        {fieldError(key)}
        {opts.help && hint(opts.help)}
      </div>
    );
  };

  const whyErrors = listErrors(errors, "whyChoose");
  const faqErrors = listErrors(errors, "faqs");
  const hiddenFaqs = v.faqs.filter((f) => f.question.trim() && !f.answer.trim()).length;

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-4" noValidate>
      <Card title="Ordering">
        <div className="space-y-5">
          <div className={cn("rounded-lg border p-3", v.acceptingOrders ? "border-line bg-paper/60" : "border-amber-600/30 bg-amber-50")}>
            <Toggle
              id="s-acceptingOrders"
              checked={v.acceptingOrders}
              onChange={(on) => set("acceptingOrders", on)}
              label={v.acceptingOrders ? "Accepting orders" : "Orders are paused"}
              description="Turn off to pause new orders (e.g. during Eid holidays). Product pages stay visible."
            />
          </div>
          {text("closedMessage", "Message while orders are paused (Bangla)", {
            maxLength: 300,
            rows: 2,
            placeholder: "দুঃখিত, এই মুহূর্তে নতুন অর্ডার নেওয়া বন্ধ আছে।",
            help: "Shown to customers instead of the order form while orders are paused. Leave empty for the standard message.",
          })}
          <div className="grid gap-4 sm:grid-cols-3">
            {text("defaultMaxPerOrder", "Max quantity per product *", {
              maxLength: 3,
              inputMode: "numeric",
              digitsOnly: true,
              help: "Per order, 1–999. Used when a product has no own limit.",
            })}
            {text("duplicateWindowHours", "Flag repeat orders within (hours) *", {
              maxLength: 3,
              inputMode: "numeric",
              digitsOnly: true,
              help: "A new order from a phone number that ordered within this many hours is flagged. 0 = off.",
            })}
            {text("freeDeliveryMinAmount", "Free delivery from ৳", {
              maxLength: 8,
              inputMode: "numeric",
              digitsOnly: true,
              placeholder: "Off",
              help: "Product total (after discounts) that gets free delivery. Empty = off.",
            })}
          </div>
        </div>
      </Card>

      <Card title="Home page">
        <div className="space-y-4">
          {text("announcement", "Announcement bar (Bangla)", {
            maxLength: 200,
            placeholder: "e.g. ঈদ উপলক্ষে সব গিফট বক্সে বিশেষ ছাড়!",
            help: "A thin bar at the top of every store page. Leave empty to hide it.",
          })}
          {text("homeHeadline", "Headline", { maxLength: 120, help: "The large heading on the home page." })}
          {text("homeSubheadline", "Sub-headline", { maxLength: 300, rows: 2, help: "One or two sentences under the headline." })}
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("contactPhone", "Contact phone", {
            maxLength: 20,
            type: "tel",
            inputMode: "tel",
            placeholder: "01XXXXXXXXX",
            help: "Shown in the footer as a tap-to-call link.",
          })}
          {text("whatsappNumber", "WhatsApp number", {
            maxLength: 20,
            type: "tel",
            inputMode: "tel",
            placeholder: "01XXXXXXXXX",
            help: "A Bangladeshi mobile number with WhatsApp, e.g. 01712345678. Leave empty to hide the WhatsApp link.",
          })}
          {text("messengerUrl", "Messenger link", {
            maxLength: 300,
            type: "url",
            inputMode: "url",
            placeholder: "https://m.me/yourpage",
            help: "Must start with https://. Leave empty to hide.",
          })}
          {text("facebookPageUrl", "Facebook page link", {
            maxLength: 300,
            type: "url",
            inputMode: "url",
            placeholder: "https://www.facebook.com/…",
            help: "Must start with https://. Empty = the built-in Deenbox page link.",
          })}
          {text("email", "Email", { maxLength: 120, type: "email", inputMode: "email", placeholder: "hello@example.com", help: "Optional." })}
          {text("businessAddress", "Business address", { maxLength: 300, rows: 2, help: "Optional. Shown in the footer.", className: "sm:col-span-2" })}
        </div>
      </Card>

      <Card title="Why choose Deenbox">
        <p className="-mt-1 mb-4 text-sm text-muted">Short cards on the home and product pages (up to 12). Only state what is true.</p>
        {whyErrors.length > 0 && (
          <div className="mb-3">
            <Notice tone="error">
              {whyErrors.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </Notice>
          </div>
        )}
        <PairListEditor
          value={v.whyChoose}
          onChange={(x) => set("whyChoose", x)}
          fields={[
            { key: "title", label: "Title", maxLength: 80 },
            { key: "description", label: "Description", multiline: true, maxLength: 300 },
          ]}
          addLabel="Add reason"
          max={12}
        />
      </Card>

      <Card title="FAQ">
        <div className="-mt-1 mb-4 space-y-2 text-sm text-muted">
          <p>Common questions shown on the home page and under every product&apos;s own FAQ (up to 40).</p>
          <Notice tone="info">
            <p>
              Answers can use placeholders that always show the current delivery setup: <code className="font-mono font-semibold">{"{deliveryCharges}"}</code>{" "}
              → each zone&apos;s charge (plus the free-delivery rule), <code className="font-mono font-semibold">{"{deliveryTimes}"}</code> → each
              zone&apos;s estimated delivery time.
            </p>
            <p className="mt-1">
              A question whose answer is empty is <strong>hidden on the site</strong> until you write the answer (also when a placeholder has no data
              yet, e.g. no delivery times set).
            </p>
          </Notice>
          {hiddenFaqs > 0 && (
            <p className="text-amber-800">
              {hiddenFaqs} question{hiddenFaqs === 1 ? " is" : "s are"} currently hidden because the answer is empty.
            </p>
          )}
        </div>
        {faqErrors.length > 0 && (
          <div className="mb-3">
            <Notice tone="error">
              {faqErrors.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </Notice>
          </div>
        )}
        <PairListEditor
          value={v.faqs}
          onChange={(x) => set("faqs", x)}
          fields={[
            { key: "question", label: "Question", maxLength: 200 },
            { key: "answer", label: "Answer", multiline: true, maxLength: 2000, placeholder: "Answer (empty = hidden on the site)" },
          ]}
          addLabel="Add question"
          max={40}
        />
      </Card>

      <Card title="Return / exchange policy">
        {text("returnPolicy", "Policy text (Bangla)", {
          maxLength: 3000,
          rows: 8,
          help: "Shown on the policy page linked from the footer. Leave empty to hide the page. Leave a blank line between paragraphs.",
        })}
      </Card>

      <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
          <div className="flex gap-2">
            {dirty && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setV(saved);
                  setErrors({});
                  setResult(null);
                }}
                className={`${abtn.secondary} ${abtn.md}`}
              >
                Discard
              </button>
            )}
            <button type="submit" disabled={pending || !dirty} className={`${abtn.primary} ${abtn.md}`}>
              {pending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
