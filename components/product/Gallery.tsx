"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlaceholder } from "@/components/store/ImagePlaceholder";
import { Icon } from "@/components/ui/Icon";
import type { ImageInfo } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { toBanglaDigits } from "@/lib/phone";

/** Main product image with thumbnails and a full-screen zoom viewer. */
export function Gallery({ images, name }: { images: ImageInfo[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = images[index];

  if (!images.length || !current) {
    return (
      <div className="aspect-square overflow-hidden rounded-card border border-line">
        <ImagePlaceholder />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block aspect-square w-full overflow-hidden rounded-card border border-line bg-sand"
        aria-label={`${name} — ছবি বড় করে দেখুন`}
      >
        <Image
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
        />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-ink shadow-soft">
          <Icon name="zoom" className="size-4" /> বড় করুন
        </span>
      </button>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1" aria-label="আরও ছবি">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "relative block size-18 overflow-hidden rounded-xl border-2 bg-sand transition-colors sm:size-20",
                  i === index ? "border-pine-700" : "border-transparent opacity-80 hover:opacity-100",
                )}
                aria-label={`ছবি ${toBanglaDigits(i + 1)}`}
                aria-current={i === index}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <Lightbox images={images} start={index} onClose={() => setOpen(false)} onIndex={setIndex} />}
    </div>
  );
}

export function Lightbox({
  images,
  start,
  onClose,
  onIndex,
}: {
  images: ImageInfo[];
  start: number;
  onClose: () => void;
  onIndex?: (i: number) => void;
}) {
  const [i, setI] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      setI((prev) => {
        const next = (prev + delta + images.length) % images.length;
        onIndex?.(next);
        return next;
      });
    },
    [images.length, onIndex],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      dialog?.close();
    };
  }, [go]);

  const img = images[i]!;
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink/95 p-0 text-white backdrop:bg-ink/80"
      aria-label="ছবি গ্যালারি"
    >
      <div
        className="relative flex h-full w-full items-center justify-center"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          if (start != null && end != null && Math.abs(end - start) > 50 && !zoomed) go(end < start ? 1 : -1);
          touchX.current = null;
        }}
      >
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className={cn("relative h-full w-full overflow-auto", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
          aria-label={zoomed ? "ছোট করুন" : "আরও বড় করুন"}
        >
          <span className={cn("relative mx-auto block h-full", zoomed ? "w-[200%] max-w-none sm:w-[160%]" : "w-full")}>
            <Image src={img.url} alt={img.alt} fill sizes="100vw" quality={85} className="object-contain" />
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="বন্ধ করুন"
          autoFocus
        >
          <Icon name="x" className="size-6" />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="আগের ছবি"
            >
              <Icon name="chevronLeft" className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="পরের ছবি"
            >
              <Icon name="chevronRight" className="size-6" />
            </button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm">
              {toBanglaDigits(i + 1)} / {toBanglaDigits(images.length)}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
