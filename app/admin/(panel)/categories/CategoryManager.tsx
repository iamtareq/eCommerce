"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { abtn, ainput, alabel, atextarea, Badge, Card, EmptyState, Notice, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { slugify } from "@/lib/admin/common";
import { deleteCategory, saveCategory } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

interface CategoryFormValue {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

type Result = { tone: "success" | "error"; text: string } | null;

const EMPTY: CategoryFormValue = { name: "", slug: "", description: "", sortOrder: "0", isActive: true };

function CategoryStatus({ active }: { active: boolean }) {
  return active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Hidden</Badge>;
}

function toFormValue(c: CategoryRow): CategoryFormValue {
  return { id: c.id, name: c.name, slug: c.slug, description: c.description ?? "", sortOrder: String(c.sortOrder), isActive: c.isActive };
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryFormValue | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  function open(value: CategoryFormValue) {
    setResult(null);
    setEditing(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saved(message: string) {
    setEditing(null);
    setResult({ tone: "success", text: message });
    router.refresh();
  }

  function remove(c: CategoryRow) {
    const msg = c.productCount
      ? `Delete the category "${c.name}"?\n\nIts ${c.productCount} product${c.productCount === 1 ? "" : "s"} will NOT be deleted — they will just have no category.`
      : `Delete the category "${c.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteCategory(c.id);
      if (!res.ok) {
        setResult({ tone: "error", text: res.error });
        return;
      }
      setEditing((cur) => (cur?.id === c.id ? null : cur));
      setResult({ tone: "success", text: res.message ?? "Category deleted" });
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products in the store (e.g. Gift boxes, Wall frames). Only active categories with at least one active product are shown to customers."
        actions={
          <button type="button" onClick={() => open(EMPTY)} className={`${abtn.primary} ${abtn.md}`}>
            <Icon name="plus" className="size-4" /> New category
          </button>
        }
      />

      <div className="space-y-4">
        {result && <Notice tone={result.tone}>{result.text}</Notice>}

        {editing && <CategoryForm key={editing.id ?? "new"} initial={editing} onSaved={saved} onCancel={() => setEditing(null)} />}

        <Card title={`All categories (${categories.length})`} padded={false}>
          {categories.length === 0 ? (
            <EmptyState icon="layers" title="No categories yet">
              <button type="button" onClick={() => open(EMPTY)} className="font-semibold text-pine-700 underline">
                Create your first category
              </button>
            </EmptyState>
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} ${table.stickyTable}`}>
                <thead>
                  <tr>
                    <th className={table.th}>Name</th>
                    <th className={table.th}>Slug</th>
                    <th className={table.th}>Status</th>
                    <th className={`${table.th} text-right`}>Sort</th>
                    <th className={`${table.th} text-right`}>Products</th>
                    <th className={`${table.th} ${table.actionsTh} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className={editing?.id === c.id ? "bg-pine-50" : "bg-white hover:bg-paper"}>
                      <td className={table.td}>
                        <span className="block font-semibold text-ink">{c.name}</span>
                        {c.description && <span className="mt-0.5 line-clamp-2 block max-w-md text-xs text-muted">{c.description}</span>}
                        {/* On phones the other columns start off-screen; show the essentials here too. */}
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted md:hidden">
                          <CategoryStatus active={c.isActive} />
                          {c.productCount} product{c.productCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className={`${table.td} font-mono text-xs text-ink-soft`}>{c.slug}</td>
                      <td className={table.td}><CategoryStatus active={c.isActive} /></td>
                      <td className={`${table.td} text-right tabular-nums`}>{c.sortOrder}</td>
                      <td className={`${table.td} text-right tabular-nums`}>{c.productCount}</td>
                      {/* Pinned to the right edge (see table.actionsTd); text labels hidden on phones to keep it narrow. */}
                      <td className={`${table.td} ${table.actionsTd} text-right`}>
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => open(toFormValue(c))} className={`${abtn.ghost} ${abtn.sm}`} aria-label={`Edit ${c.name}`}>
                            <Icon name="edit" className="size-4" /> <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(c)}
                            disabled={pending}
                            className={`${abtn.ghost} ${abtn.sm} text-danger-700`}
                            aria-label={`Delete ${c.name}`}
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

function CategoryForm({ initial, onSaved, onCancel }: { initial: CategoryFormValue; onSaved: (message: string) => void; onCancel: () => void }) {
  const [v, setV] = useState<CategoryFormValue>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CategoryFormValue>(key: K, value: CategoryFormValue[K]) => setV((prev) => ({ ...prev, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveCategory({
        id: v.id,
        name: v.name,
        slug: v.slug,
        description: v.description,
        sortOrder: v.sortOrder.trim() === "" ? 0 : Number(v.sortOrder),
        isActive: v.isActive,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(res.message ?? "Category saved");
    });
  }

  return (
    <Card title={v.id ? `Edit category: ${initial.name}` : "New category"}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category-name" className={alabel}>
              Name *
            </label>
            <input
              id="category-name"
              value={v.name}
              maxLength={80}
              required
              onChange={(e) => {
                const name = e.target.value;
                setV((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : name.trim() ? slugify(name) : "" }));
              }}
              className={ainput}
              placeholder="e.g. Gift boxes / গিফট বক্স"
            />
          </div>
          <div>
            <label htmlFor="category-slug" className={alabel}>
              URL slug *
            </label>
            <input
              id="category-slug"
              value={v.slug}
              maxLength={80}
              required
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              className={`${ainput} font-mono`}
              placeholder="gift-boxes"
              aria-describedby="category-slug-help"
            />
            <p id="category-slug-help" className="mt-1 text-xs text-muted">
              English letters, numbers and dashes. Used in the store link <span className="font-mono">/products?category={v.slug || "…"}</span>
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="category-description" className={alabel}>
              Description
            </label>
            <textarea
              id="category-description"
              rows={2}
              maxLength={500}
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              className={atextarea}
            />
          </div>
          <div>
            <label htmlFor="category-sort" className={alabel}>
              Sort order
            </label>
            <input
              id="category-sort"
              value={v.sortOrder}
              inputMode="numeric"
              onChange={(e) => set("sortOrder", e.target.value.replace(/[^\d-]/g, ""))}
              className={ainput}
              aria-describedby="category-sort-help"
            />
            <p id="category-sort-help" className="mt-1 text-xs text-muted">
              Lower numbers show first.
            </p>
          </div>
          <div className="flex items-center sm:pt-6">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="size-4 accent-pine-700" />
              Active (visible in the store)
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="submit" disabled={pending} className={`${abtn.primary} ${abtn.md}`}>
            {pending ? "Saving…" : v.id ? "Save changes" : "Create category"}
          </button>
          <button type="button" onClick={onCancel} disabled={pending} className={`${abtn.secondary} ${abtn.md}`}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
