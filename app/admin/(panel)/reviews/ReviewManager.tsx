"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { uploadImage } from "@/components/admin/ImageUploader";
import { abtn, ainput, alabel, atextarea, Badge, Card, EmptyState, Notice, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { deleteReview, saveReview } from "./actions";

export interface ReviewRow {
  id: string;
  productId: string | null;
  productName: string | null;
  customerName: string;
  location: string | null;
  rating: number;
  text: string;
  imageUrl: string | null;
  imageKey: string | null;
  isPublished: boolean;
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

interface ReviewFormValue {
  id?: string;
  /** "" = general review (all pages). */
  productId: string;
  customerName: string;
  location: string;
  rating: string;
  text: string;
  image: { url: string; key: string } | null;
  isPublished: boolean;
  sortOrder: string;
}

type Result = { tone: "success" | "error"; text: string } | null;

const EMPTY: ReviewFormValue = {
  productId: "",
  customerName: "",
  location: "",
  rating: "5",
  text: "",
  image: null,
  isPublished: true,
  sortOrder: "0",
};

const RATING_LABELS: Record<number, string> = { 5: "Excellent", 4: "Good", 3: "Average", 2: "Poor", 1: "Very poor" };

function toFormValue(r: ReviewRow): ReviewFormValue {
  return {
    id: r.id,
    productId: r.productId ?? "",
    customerName: r.customerName,
    location: r.location ?? "",
    rating: String(r.rating),
    text: r.text,
    image: r.imageUrl && r.imageKey ? { url: r.imageUrl, key: r.imageKey } : null,
    isPublished: r.isPublished,
    sortOrder: String(r.sortOrder),
  };
}

function excerpt(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" className={cn("size-3.5", i > rating && "text-stone-300")} />
      ))}
    </span>
  );
}

export function ReviewManager({ reviews, products }: { reviews: ReviewRow[]; products: ProductOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ReviewFormValue | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  function open(value: ReviewFormValue) {
    setResult(null);
    setEditing(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saved(message: string) {
    setEditing(null);
    setResult({ tone: "success", text: message });
    router.refresh();
  }

  function remove(r: ReviewRow) {
    const msg = `Delete the review by ${r.customerName}?${r.imageKey ? " Its screenshot will be deleted too." : ""} This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteReview(r.id);
      if (!res.ok) {
        setResult({ tone: "error", text: res.error });
        return;
      }
      setEditing((cur) => (cur?.id === r.id ? null : cur));
      setResult({ tone: "success", text: res.message ?? "Review deleted" });
      router.refresh();
    });
  }

  const published = reviews.filter((r) => r.isPublished).length;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Customer reviews shown in the store. Product reviews appear on that product's page; general reviews appear everywhere."
        actions={
          <button type="button" onClick={() => open(EMPTY)} className={`${abtn.primary} ${abtn.md}`}>
            <Icon name="plus" className="size-4" /> Add review
          </button>
        }
      />

      <div className="space-y-4">
        <Notice tone="warning">
          <strong>Only add genuine reviews from real customers</strong> (e.g. from Facebook/Messenger). Do not invent reviews.
        </Notice>

        {result && <Notice tone={result.tone}>{result.text}</Notice>}

        {editing && <ReviewForm key={editing.id ?? "new"} initial={editing} products={products} onSaved={saved} onCancel={() => setEditing(null)} />}

        <Card title={`All reviews (${reviews.length}) · ${published} published`} padded={false}>
          {reviews.length === 0 ? (
            <EmptyState icon="star" title="No reviews yet">
              <button type="button" onClick={() => open(EMPTY)} className="font-semibold text-pine-700 underline">
                Add a real customer review
              </button>
            </EmptyState>
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} ${table.stickyTable} min-w-[760px]`}>
                <thead>
                  <tr>
                    <th className={table.th}>Customer</th>
                    <th className={table.th}>Product</th>
                    <th className={table.th}>Rating</th>
                    <th className={table.th}>Review</th>
                    <th className={table.th}>Status</th>
                    <th className={`${table.th} ${table.actionsTh} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className={editing?.id === r.id ? "bg-pine-50" : "bg-white hover:bg-paper"}>
                      <td className={table.td}>
                        <span className="block font-semibold text-ink">{r.customerName}</span>
                        {r.location && <span className="block text-xs text-muted">{r.location}</span>}
                      </td>
                      <td className={table.td}>{r.productName ?? <span className="text-muted">General</span>}</td>
                      <td className={`${table.td} whitespace-nowrap`}>
                        <Stars rating={r.rating} />
                        <span className="ml-1.5 text-xs font-semibold text-ink-soft tabular-nums">{r.rating}/5</span>
                      </td>
                      <td className={table.td}>
                        <span lang="bn" className="block max-w-sm text-ink-soft">
                          {excerpt(r.text)}
                        </span>
                        {r.imageUrl && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                            <Icon name="image" className="size-3.5" /> Screenshot attached
                          </span>
                        )}
                      </td>
                      <td className={table.td}>{r.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
                      {/* Pinned to the right edge (see table.actionsTd); text labels hidden on phones to keep it narrow. */}
                      <td className={`${table.td} ${table.actionsTd} text-right`}>
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => open(toFormValue(r))} className={`${abtn.ghost} ${abtn.sm}`} aria-label={`Edit review by ${r.customerName}`}>
                            <Icon name="edit" className="size-4" /> <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(r)}
                            disabled={pending}
                            className={`${abtn.ghost} ${abtn.sm} text-danger-700`}
                            aria-label={`Delete review by ${r.customerName}`}
                          >
                            <Icon name="trash" className="size-4" /> <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

const STATUS_SUFFIX: Record<ProductOption["status"], string> = { ACTIVE: "", DRAFT: " (draft)", ARCHIVED: " (archived)" };

function ReviewForm({
  initial,
  products,
  onSaved,
  onCancel,
}: {
  initial: ReviewFormValue;
  products: ProductOption[];
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<ReviewFormValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ReviewFormValue>(key: K, value: ReviewFormValue[K]) => setV((prev) => ({ ...prev, [key]: value }));

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const img = await uploadImage(file, "reviews");
      set("image", { url: img.url, key: img.key });
    } catch (e) {
      setError(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveReview({
        id: v.id,
        productId: v.productId || null,
        customerName: v.customerName,
        location: v.location,
        rating: Number(v.rating),
        text: v.text,
        image: v.image,
        isPublished: v.isPublished,
        sortOrder: v.sortOrder.trim() === "" ? 0 : Number(v.sortOrder),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(res.message ?? "Review saved");
    });
  }

  return (
    <Card title={v.id ? `Edit review by ${initial.customerName}` : "Add review"}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="review-name" className={alabel}>
              Customer name *
            </label>
            <input
              id="review-name"
              value={v.customerName}
              maxLength={80}
              required
              onChange={(e) => set("customerName", e.target.value)}
              className={ainput}
              placeholder="e.g. রাশিদা আক্তার"
            />
          </div>
          <div>
            <label htmlFor="review-location" className={alabel}>
              Location
            </label>
            <input
              id="review-location"
              value={v.location}
              maxLength={80}
              onChange={(e) => set("location", e.target.value)}
              className={ainput}
              placeholder="e.g. মিরপুর, ঢাকা"
            />
          </div>
          <div>
            <label htmlFor="review-product" className={alabel}>
              Product
            </label>
            <select id="review-product" value={v.productId} onChange={(e) => set("productId", e.target.value)} className={ainput}>
              <option value="">General (all pages)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {STATUS_SUFFIX[p.status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="review-rating" className={alabel}>
              Rating *
            </label>
            <select id="review-rating" value={v.rating} onChange={(e) => set("rating", e.target.value)} className={ainput}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                  {"☆".repeat(5 - n)} {n} – {RATING_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-end justify-between gap-2">
              <label htmlFor="review-text" className={alabel}>
                Review text *
              </label>
              <span className="mb-1 text-xs text-muted tabular-nums" aria-hidden="true">
                {v.text.length}/1000
              </span>
            </div>
            <textarea
              id="review-text"
              lang="bn"
              rows={4}
              maxLength={1000}
              required
              value={v.text}
              onChange={(e) => set("text", e.target.value)}
              className={atextarea}
              aria-describedby="review-text-help"
            />
            <p id="review-text-help" className="mt-1 text-xs text-muted">
              Copy the customer&apos;s own words. Small spelling fixes are fine; do not change the meaning.
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className={alabel} id="review-image-label">
              Screenshot (optional)
            </p>
            <div className="flex flex-wrap items-start gap-4">
              {v.image && (
                <a
                  href={v.image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-sand"
                  title="Open full size"
                >
                  <Image src={v.image.url} alt="Review screenshot preview" fill sizes="128px" className="object-contain" />
                </a>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {/* Must sit right before its <label>: the button styles show this hidden input's keyboard focus. */}
                  <input
                    ref={fileInput}
                    id="review-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    aria-labelledby="review-image-label"
                    onChange={(e) => onFile(e.target.files?.[0])}
                    disabled={uploading}
                  />
                  <label htmlFor="review-image" className={cn(abtn.secondary, abtn.sm, "cursor-pointer", uploading && "pointer-events-none opacity-50")}>
                    <Icon name="upload" className="size-4" />
                    {uploading ? "Uploading…" : v.image ? "Replace image" : "Upload screenshot"}
                  </label>
                  {v.image && (
                    <button type="button" onClick={() => set("image", null)} disabled={uploading} className={`${abtn.ghost} ${abtn.sm} text-danger-700`}>
                      <Icon name="trash" className="size-4" /> Remove image
                    </button>
                  )}
                </div>
                <p className="max-w-sm text-xs text-muted">
                  E.g. a screenshot of the Facebook comment or Messenger message. Hide the customer&apos;s phone number or other private details
                  first. JPG, PNG or WebP, up to 8 MB.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="review-sort" className={alabel}>
              Sort order
            </label>
            <input
              id="review-sort"
              value={v.sortOrder}
              inputMode="numeric"
              onChange={(e) => set("sortOrder", e.target.value.replace(/[^\d-]/g, ""))}
              className={ainput}
              aria-describedby="review-sort-help"
            />
            <p id="review-sort-help" className="mt-1 text-xs text-muted">
              Lower numbers show first.
            </p>
          </div>
          <div className="flex items-center sm:pt-6">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={v.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="size-4 accent-pine-700" />
              Published (visible in the store)
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="submit" disabled={pending || uploading} className={`${abtn.primary} ${abtn.md}`}>
            {pending ? "Saving…" : v.id ? "Save changes" : "Add review"}
          </button>
          <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
