"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct, saveProduct } from "@/app/admin/(panel)/products/actions";
import { Icon } from "@/components/ui/Icon";
import { slugify } from "@/lib/admin/common";
import type { ProductInput } from "@/lib/validation/product";
import { ImagesEditor, type UploadedImage } from "./ImageUploader";
import { isBlankRow, move, PairListEditor, TextListEditor } from "./ListEditors";
import { abtn, ainput, alabel, atextarea, Card, Notice } from "./ui";

export interface ProductFormValue {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  sortOrder: string;
  headline: string;
  shortDescription: string;
  description: string;
  variantLabel: string;
  maxPerOrder: string;
  seoTitle: string;
  seoDescription: string;
  benefits: { title: string; description: string }[];
  includedItems: string[];
  specifications: { label: string; value: string }[];
  howToUse: string[];
  importantNotes: string[];
  faqs: { question: string; answer: string }[];
  images: UploadedImage[];
  /** originalStock: stock as loaded from the database (existing variants), so a save never undoes orders placed meanwhile. */
  variants: { id?: string; name: string; sku: string; price: string; compareAtPrice: string; stock: string; originalStock?: number | null; isActive: boolean }[];
  tiers: { minQuantity: string; type: "PERCENT" | "FIXED"; value: string; isActive: boolean }[];
}

export const emptyProduct: ProductFormValue = {
  name: "",
  slug: "",
  categoryId: "",
  status: "DRAFT",
  isFeatured: false,
  sortOrder: "0",
  headline: "",
  shortDescription: "",
  description: "",
  variantLabel: "ধরন",
  maxPerOrder: "",
  seoTitle: "",
  seoDescription: "",
  benefits: [],
  includedItems: [],
  specifications: [],
  howToUse: [],
  importantNotes: [],
  faqs: [],
  images: [],
  variants: [{ name: "", sku: "", price: "", compareAtPrice: "", stock: "", isActive: true }],
  tiers: [],
};

const int = (s: string) => (s.trim() === "" ? null : Math.round(Number(s)));

/** Drops completely empty list rows. Partly filled rows are kept so validation reports them instead of losing the text. */
function withoutBlankRows(v: ProductFormValue): ProductFormValue {
  return {
    ...v,
    benefits: v.benefits.filter((r) => !isBlankRow(r)),
    includedItems: v.includedItems.filter((s) => s.trim()),
    specifications: v.specifications.filter((r) => !isBlankRow(r)),
    howToUse: v.howToUse.filter((s) => s.trim()),
    importantNotes: v.importantNotes.filter((s) => s.trim()),
    faqs: v.faqs.filter((r) => !isBlankRow(r)),
  };
}

function toInput(v: ProductFormValue): ProductInput {
  return {
    id: v.id,
    name: v.name,
    slug: v.slug,
    categoryId: v.categoryId || null,
    status: v.status,
    isFeatured: v.isFeatured,
    sortOrder: int(v.sortOrder) ?? 0,
    headline: v.headline,
    shortDescription: v.shortDescription,
    description: v.description,
    variantLabel: v.variantLabel || "ধরন",
    maxPerOrder: int(v.maxPerOrder),
    seoTitle: v.seoTitle,
    seoDescription: v.seoDescription,
    benefits: v.benefits,
    includedItems: v.includedItems,
    specifications: v.specifications,
    howToUse: v.howToUse,
    importantNotes: v.importantNotes,
    faqs: v.faqs,
    images: v.images,
    variants: v.variants.map((x) => ({
      id: x.id,
      name: x.name,
      sku: x.sku,
      price: int(x.price) ?? -1,
      compareAtPrice: int(x.compareAtPrice),
      stock: int(x.stock),
      originalStock: x.originalStock ?? null,
      isActive: x.isActive,
    })),
    tiers: v.tiers.map((t) => ({ minQuantity: int(t.minQuantity) ?? 0, type: t.type, value: int(t.value) ?? 0, isActive: t.isActive })),
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card title={title}>
      {description && <p className="-mt-1 mb-4 text-sm text-muted">{description}</p>}
      {children}
    </Card>
  );
}

export function ProductForm({
  initial,
  categories,
  hasOrders = false,
  reviewCount = 0,
  notice,
}: {
  initial: ProductFormValue;
  categories: { id: string; name: string }[];
  hasOrders?: boolean;
  reviewCount?: number;
  /** Success message from the URL (?saved=…). It survives the remount that follows every save. */
  notice?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValue>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(notice ? { tone: "success", text: notice } : null);

  const set = <K extends keyof ProductFormValue>(key: K, value: ProductFormValue[K]) => setV((prev) => ({ ...prev, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Images still uploading would be left out of the save (and lost when the form reloads).
    if (uploading > 0) return;
    setResult(null);
    // Drop completely empty rows so the row numbers in error messages match what is shown.
    const next = withoutBlankRows(v);
    setV(withoutBlankRows);
    startTransition(async () => {
      const res = await saveProduct(toInput(next));
      if (!res.ok) {
        if ("stockConflicts" in res) {
          // The message shows the current stock; saving again applies the owner's value over it.
          const now = new Map(res.stockConflicts.map((c) => [c.id, c.stock]));
          setV((prev) => ({
            ...prev,
            variants: prev.variants.map((x) => (x.id && now.has(x.id) ? { ...x, originalStock: now.get(x.id) } : x)),
          }));
        }
        setResult({ tone: "error", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // The page re-renders with fresh data and remounts this form (keyed on updatedAt), so the
      // confirmation travels in the URL. Kept inside the transition so Save stays disabled until then.
      const target = `/admin/products/${res.data?.id ?? v.id}?saved=${v.id ? "updated" : "1"}`;
      startTransition(() => {
        if (`${window.location.pathname}${window.location.search}` === target) {
          router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.replace(target);
        }
      });
    });
  }

  function remove() {
    const msg = hasOrders
      ? "This product has orders, so it will be archived (hidden from the store) instead of deleted. Continue?"
      : `Delete this product permanently? This cannot be undone.${
          reviewCount > 0 ? `\n\nIts ${reviewCount} review(s) will be unpublished, so they don't show up as general store reviews.` : ""
        }`;
    if (!v.id || !window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteProduct(v.id!);
      if (!res.ok) setResult({ tone: "error", text: res.error });
      else router.push("/admin/products");
    });
  }

  const variantCount = v.variants.length;

  return (
    <form onSubmit={submit} className="space-y-4">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Section title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className={alabel}>
                  Product name *
                </label>
                <input
                  id="name"
                  value={v.name}
                  maxLength={120}
                  required
                  onChange={(e) => {
                    const name = e.target.value;
                    setV((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
                  }}
                  className={ainput}
                  placeholder="e.g. আয়াতুল কুরসি ওয়াল ফ্রেম"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="slug" className={alabel}>
                  URL slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted">/products/</span>
                  <input
                    id="slug"
                    value={v.slug}
                    maxLength={80}
                    required
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }}
                    className={`${ainput} font-mono`}
                    placeholder="ayatul-kursi-wall-frame"
                  />
                </div>
                <p className="mt-1 text-xs text-muted">English letters, numbers and dashes. This is the link you share on Facebook.</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="headline" className={alabel}>
                  Hero headline (Bangla)
                </label>
                <input
                  id="headline"
                  value={v.headline}
                  maxLength={160}
                  onChange={(e) => set("headline", e.target.value)}
                  className={ainput}
                  placeholder="e.g. প্রিয়জনকে দিন দ্বীনের সুন্দর উপহার"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="short" className={alabel}>
                  Short description
                </label>
                <textarea id="short" rows={2} maxLength={400} value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={atextarea} />
                <p className="mt-1 text-xs text-muted">Shown under the name and on product cards (1–2 sentences).</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className={alabel}>
                  Full description
                </label>
                <textarea id="description" rows={6} maxLength={8000} value={v.description} onChange={(e) => set("description", e.target.value)} className={atextarea} />
                <p className="mt-1 text-xs text-muted">What the product is and why it is useful. Leave a blank line between paragraphs.</p>
              </div>
            </div>
          </Section>

          <Section title="Images" description="The first image is the main photo. Upload real product photos only.">
            <ImagesEditor
              value={v.images}
              onChange={(update) => setV((prev) => ({ ...prev, images: update(prev.images) }))}
              onBusyChange={setUploading}
              disabled={pending}
            />
          </Section>

          <Section
            title="Prices & variants"
            description="Add one row for a simple product, or one row per size/colour. Prices are in whole taka. Leave stock empty if you don't track it."
          >
            <div className="mb-4 max-w-xs">
              <label htmlFor="variantLabel" className={alabel}>
                Variant label (shown to customers)
              </label>
              <input id="variantLabel" value={v.variantLabel} maxLength={40} onChange={(e) => set("variantLabel", e.target.value)} className={ainput} placeholder="সাইজ / রং" />
            </div>
            <div className="space-y-3">
              {v.variants.map((x, i) => {
                const upd = (patch: Partial<typeof x>) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                const fid = (field: string) => `variant-${i}-${field}`;
                return (
                  <div key={x.id ?? `new-${i}`} role="group" aria-label={`Variant ${i + 1}`} className="rounded-lg border border-line bg-paper/60 p-3">
                    <div className="grid gap-2 sm:grid-cols-6">
                      <div className="sm:col-span-2">
                        <label htmlFor={fid("name")} className="mb-1 block text-xs font-semibold text-muted">
                          Name {variantCount > 1 ? "*" : "(optional)"}
                        </label>
                        <input id={fid("name")} value={x.name} maxLength={80} onChange={(e) => upd({ name: e.target.value })} className={ainput} placeholder="12×18 ইঞ্চি" />
                      </div>
                      <div>
                        <label htmlFor={fid("price")} className="mb-1 block text-xs font-semibold text-muted">
                          Price ৳ *
                        </label>
                        <input id={fid("price")} value={x.price} inputMode="numeric" onChange={(e) => upd({ price: e.target.value.replace(/\D/g, "") })} className={ainput} required />
                      </div>
                      <div>
                        <label htmlFor={fid("previous")} className="mb-1 block text-xs font-semibold text-muted">
                          Previous ৳
                        </label>
                        <input
                          id={fid("previous")}
                          value={x.compareAtPrice}
                          inputMode="numeric"
                          onChange={(e) => upd({ compareAtPrice: e.target.value.replace(/\D/g, "") })}
                          className={ainput}
                        />
                      </div>
                      <div>
                        <label htmlFor={fid("stock")} className="mb-1 block text-xs font-semibold text-muted">
                          Stock
                        </label>
                        <input id={fid("stock")} value={x.stock} inputMode="numeric" onChange={(e) => upd({ stock: e.target.value.replace(/\D/g, "") })} className={ainput} placeholder="∞" />
                      </div>
                      <div>
                        <label htmlFor={fid("sku")} className="mb-1 block text-xs font-semibold text-muted">
                          SKU
                        </label>
                        <input id={fid("sku")} value={x.sku} maxLength={60} onChange={(e) => upd({ sku: e.target.value })} className={`${ainput} font-mono`} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-ink-soft">
                        <input type="checkbox" checked={x.isActive} onChange={(e) => upd({ isActive: e.target.checked })} className="size-4 accent-pine-700" />
                        Available for sale
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => set("variants", move(v.variants, i, i - 1))}
                          disabled={i === 0}
                          className={`${abtn.ghost} size-8 p-0`}
                          aria-label={`Move variant ${i + 1} up`}
                        >
                          <Icon name="arrowUp" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => set("variants", move(v.variants, i, i + 1))}
                          disabled={i === variantCount - 1}
                          className={`${abtn.ghost} size-8 p-0`}
                          aria-label={`Move variant ${i + 1} down`}
                        >
                          <Icon name="arrowDown" className="size-4" />
                        </button>
                        {variantCount > 1 && (
                          <button
                            type="button"
                            onClick={() => set("variants", v.variants.filter((_, j) => j !== i))}
                            className={`${abtn.ghost} h-8 px-2 text-xs text-danger-700`}
                            aria-label={`Remove variant ${i + 1}`}
                          >
                            <Icon name="trash" className="size-4" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => set("variants", [...v.variants, { name: "", sku: "", price: "", compareAtPrice: "", stock: "", isActive: true }])}
                className={`${abtn.secondary} ${abtn.sm}`}
              >
                <Icon name="plus" className="size-4" /> Add variant
              </button>
            </div>
          </Section>

          <Section title="Quantity discounts" description='"Buy N or more of this product, get a discount." The highest matching tier applies.'>
            <div className="space-y-2">
              {v.tiers.map((t, i) => {
                const upd = (patch: Partial<typeof t>) => set("tiers", v.tiers.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                const fid = (field: string) => `tier-${i}-${field}`;
                return (
                  <div key={i} role="group" aria-label={`Discount tier ${i + 1}`} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper/60 p-3">
                    <div className="w-28">
                      <label htmlFor={fid("min")} className="mb-1 block text-xs font-semibold text-muted">
                        Min. quantity
                      </label>
                      <input id={fid("min")} value={t.minQuantity} inputMode="numeric" onChange={(e) => upd({ minQuantity: e.target.value.replace(/\D/g, "") })} className={ainput} />
                    </div>
                    <div className="w-36">
                      <label htmlFor={fid("type")} className="mb-1 block text-xs font-semibold text-muted">
                        Type
                      </label>
                      <select id={fid("type")} value={t.type} onChange={(e) => upd({ type: e.target.value as "PERCENT" | "FIXED" })} className={ainput}>
                        <option value="PERCENT">Percent off</option>
                        <option value="FIXED">Taka off (total)</option>
                      </select>
                    </div>
                    <div className="w-28">
                      <label htmlFor={fid("value")} className="mb-1 block text-xs font-semibold text-muted">
                        {t.type === "PERCENT" ? "Percent" : "Amount ৳"}
                      </label>
                      <input id={fid("value")} value={t.value} inputMode="numeric" onChange={(e) => upd({ value: e.target.value.replace(/\D/g, "") })} className={ainput} />
                    </div>
                    <label className="mb-2.5 flex items-center gap-2 text-sm text-ink-soft">
                      <input type="checkbox" checked={t.isActive} onChange={(e) => upd({ isActive: e.target.checked })} className="size-4 accent-pine-700" />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => set("tiers", v.tiers.filter((_, j) => j !== i))}
                      className={`${abtn.ghost} mb-1 ml-auto h-8 px-2 text-xs text-danger-700`}
                      aria-label={`Remove discount tier ${i + 1}`}
                    >
                      <Icon name="trash" className="size-4" /> Remove
                    </button>
                  </div>
                );
              })}
              {v.tiers.length < 10 && (
                <button type="button" onClick={() => set("tiers", [...v.tiers, { minQuantity: "2", type: "PERCENT", value: "", isActive: true }])} className={`${abtn.secondary} ${abtn.sm}`}>
                  <Icon name="plus" className="size-4" /> Add tier
                </button>
              )}
            </div>
          </Section>

          <Section title="Benefits" description="Short benefit cards. Only state what is true about the product.">
            <PairListEditor
              value={v.benefits}
              onChange={(benefits) => set("benefits", benefits)}
              fields={[
                { key: "title", label: "Title", maxLength: 80 },
                { key: "description", label: "Description", multiline: true, maxLength: 300 },
              ]}
              addLabel="Add benefit"
              max={12}
            />
          </Section>

          <Section title="Details">
            <div className="space-y-5">
              <div>
                <p className={alabel}>What&apos;s in the box</p>
                <TextListEditor value={v.includedItems} onChange={(x) => set("includedItems", x)} addLabel="Add item" placeholder="e.g. ১টি কাঠের ফ্রেম" />
              </div>
              <div>
                <p className={alabel}>Specifications</p>
                <PairListEditor
                  value={v.specifications}
                  onChange={(x) => set("specifications", x)}
                  fields={[
                    { key: "label", label: "Label", placeholder: "e.g. মাপ", maxLength: 60 },
                    { key: "value", label: "Value", placeholder: "e.g. ১২ × ১৮ ইঞ্চি", maxLength: 200 },
                  ]}
                  addLabel="Add specification"
                  max={30}
                />
              </div>
              <div>
                <p className={alabel}>How to use</p>
                <TextListEditor value={v.howToUse} onChange={(x) => set("howToUse", x)} addLabel="Add step" max={20} />
              </div>
              <div>
                <p className={alabel}>Important information</p>
                <TextListEditor value={v.importantNotes} onChange={(x) => set("importantNotes", x)} addLabel="Add note" max={20} />
              </div>
            </div>
          </Section>

          <Section title="Product FAQ" description="Shown above the general FAQ on this product's page.">
            <PairListEditor
              value={v.faqs}
              onChange={(x) => set("faqs", x)}
              fields={[
                { key: "question", label: "Question", maxLength: 200 },
                { key: "answer", label: "Answer", multiline: true, maxLength: 2000 },
              ]}
              addLabel="Add question"
            />
          </Section>
        </div>

        <div className="space-y-4">
          <Card title="Publishing">
            <div className="space-y-4">
              <div>
                <label htmlFor="status" className={alabel}>
                  Status
                </label>
                <select id="status" value={v.status} onChange={(e) => set("status", e.target.value as ProductFormValue["status"])} className={ainput}>
                  <option value="DRAFT">Draft (hidden)</option>
                  <option value="ACTIVE">Active (visible in store)</option>
                  <option value="ARCHIVED">Archived (hidden)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="size-4 accent-pine-700" />
                Featured (shown first and in the home hero)
              </label>
              <div>
                <label htmlFor="category" className={alabel}>
                  Category
                </label>
                <select id="category" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={ainput}>
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Link href="/admin/categories" className="mt-1 inline-block text-xs font-semibold text-pine-700 hover:underline">
                  Manage categories
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sortOrder" className={alabel}>
                    Sort order
                  </label>
                  <input id="sortOrder" value={v.sortOrder} inputMode="numeric" onChange={(e) => set("sortOrder", e.target.value.replace(/[^\d-]/g, ""))} className={ainput} />
                </div>
                <div>
                  <label htmlFor="maxPerOrder" className={alabel}>
                    Max per order
                  </label>
                  <input
                    id="maxPerOrder"
                    value={v.maxPerOrder}
                    inputMode="numeric"
                    placeholder="Default"
                    onChange={(e) => set("maxPerOrder", e.target.value.replace(/\D/g, ""))}
                    className={ainput}
                  />
                </div>
              </div>
              <p className="text-xs text-muted">Lower sort order shows first. Empty max uses the site default (Site settings).</p>
            </div>
          </Card>

          <Card title="Search & sharing">
            <div className="space-y-3">
              <div>
                <label htmlFor="seoTitle" className={alabel}>
                  SEO title
                </label>
                <input id="seoTitle" value={v.seoTitle} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} className={ainput} placeholder={v.name} />
              </div>
              <div>
                <label htmlFor="seoDescription" className={alabel}>
                  SEO / Facebook description
                </label>
                <textarea id="seoDescription" rows={3} maxLength={300} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={atextarea} />
              </div>
            </div>
          </Card>

          <div className="sticky top-4 space-y-2 rounded-xl border border-line bg-white p-4 shadow-soft">
            <button type="submit" disabled={pending || uploading > 0} className={`${abtn.primary} h-11 w-full text-base`}>
              {pending ? "Saving…" : uploading > 0 ? "Uploading images…" : v.id ? "Save changes" : "Create product"}
            </button>
            {v.id && v.status === "ACTIVE" && (
              <Link href={`/products/${v.slug}`} target="_blank" className={`${abtn.secondary} ${abtn.md} w-full`}>
                <Icon name="external" className="size-4" /> View in store
              </Link>
            )}
            {v.id && (
              <button type="button" onClick={remove} disabled={pending || uploading > 0} className={`${abtn.danger} ${abtn.md} w-full`}>
                <Icon name="trash" className="size-4" /> {hasOrders ? "Archive product" : "Delete product"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
