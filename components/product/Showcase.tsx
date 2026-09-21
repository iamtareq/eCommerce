"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ImageInfo } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { toBanglaDigits } from "@/lib/phone";
import { Lightbox } from "./Gallery";

/** Lazy-loaded image grid of every product photo, each opening the zoom viewer. */
export function Showcase({ images, name }: { images: ImageInfo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.url} className={cn(i === 0 && images.length > 2 && "col-span-2 row-span-2")}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-card border border-line bg-sand"
              aria-label={`${name} — ছবি ${toBanglaDigits(i + 1)} বড় করে দেখুন`}
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                loading="lazy"
                sizes={i === 0 && images.length > 2 ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 50vw"}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <span className="absolute right-2.5 bottom-2.5 grid size-9 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Icon name="zoom" className="size-4.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}
