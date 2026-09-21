"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { move } from "./ListEditors";
import { abtn, ainput, Notice } from "./ui";

export interface UploadedImage {
  id?: string;
  url: string;
  key: string;
  width: number;
  height: number;
  alt: string;
}

export async function uploadImage(file: File, folder: "products" | "reviews"): Promise<UploadedImage> {
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { image?: Omit<UploadedImage, "alt">; error?: string };
  if (!res.ok || !data.image) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return { ...data.image, alt: "" };
}

/** Product image manager: upload (JPG/PNG/WebP), reorder, alt text, remove. First image = main image. */
export function ImagesEditor({
  value,
  onChange,
  onBusyChange,
  disabled = false,
  max = 20,
}: {
  value: UploadedImage[];
  /** Gets an updater, so an upload that finishes later never overwrites edits made in the meantime. */
  onChange: (update: (prev: UploadedImage[]) => UploadedImage[]) => void;
  /** Number of uploads still running (the parent blocks saving until it is 0). */
  onBusyChange?: (busy: number) => void;
  /** Blocks new uploads, e.g. while the form saves: photos added then would miss the save and be lost when it reloads. */
  disabled?: boolean;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busyRef = useRef(0);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const locked = disabled || busy > 0;

  function track(delta: number) {
    busyRef.current += delta;
    setBusy(busyRef.current);
    onBusyChange?.(busyRef.current);
  }

  /** Applies `fn` to the latest list, locating the image by key (indexes can shift while uploading). */
  function edit(key: string, fn: (list: UploadedImage[], index: number) => UploadedImage[]) {
    onChange((prev) => {
      const index = prev.findIndex((x) => x.key === key);
      return index < 0 ? prev : fn(prev, index);
    });
  }

  async function onFiles(files: FileList | null) {
    if (disabled) {
      if (input.current) input.current.value = "";
      return;
    }
    if (!files?.length || busyRef.current > 0) return;
    setError(null);
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));
    track(list.length);
    for (const file of list) {
      try {
        const img = await uploadImage(file, "products");
        onChange((prev) => [...prev, img]);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
      track(-1);
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {value.map((img, i) => (
            <li key={img.key} className="flex gap-3 rounded-lg border border-line bg-paper/60 p-2.5">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-sand">
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-pine-800/85 py-0.5 text-center text-[0.65rem] font-semibold text-white">MAIN</span>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={img.alt}
                  onChange={(e) => {
                    const alt = e.target.value;
                    edit(img.key, (list, j) => list.map((x, k) => (k === j ? { ...x, alt } : x)));
                  }}
                  placeholder="Alt text (describe the photo)"
                  maxLength={200}
                  className={`${ainput} h-9 text-sm`}
                  aria-label={`Alt text for image ${i + 1}`}
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => edit(img.key, (list, j) => move(list, j, j - 1))}
                    disabled={i === 0}
                    className={`${abtn.ghost} size-8 p-0`}
                    aria-label={`Move image ${i + 1} left`}
                  >
                    <Icon name="chevronLeft" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => edit(img.key, (list, j) => move(list, j, j + 1))}
                    disabled={i === value.length - 1}
                    className={`${abtn.ghost} size-8 p-0`}
                    aria-label={`Move image ${i + 1} right`}
                  >
                    <Icon name="chevronRight" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => edit(img.key, (list, j) => list.filter((_, k) => k !== j))}
                    className={`${abtn.ghost} ml-auto h-8 px-2 text-xs text-danger-700`}
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <Icon name="trash" className="size-4" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {value.length < max && (
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            id="product-images"
            disabled={locked}
            onChange={(e) => onFiles(e.target.files)}
          />
          <label
            htmlFor="product-images"
            aria-disabled={locked || undefined}
            className={`${abtn.secondary} ${abtn.md} cursor-pointer ${locked ? "pointer-events-none opacity-60" : ""}`}
          >
            <Icon name="upload" className="size-4" />
            {busy > 0 ? `Uploading ${busy}…` : "Upload images"}
          </label>
          <p className="mt-1.5 text-xs text-muted">JPG, PNG or WebP, up to 8 MB each. Images are resized to 1600px and converted to WebP automatically.</p>
        </div>
      )}
    </div>
  );
}
