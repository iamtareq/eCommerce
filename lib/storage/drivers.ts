import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/security";

/**
 * Image storage. Uploaded images are validated by decoding them (not by file
 * extension), auto-rotated, resized to at most 1600px and re-encoded as WebP,
 * which also strips EXIF/GPS metadata.
 *
 * STORAGE_DRIVER=local       → files under UPLOAD_DIR, served by /media/...
 * STORAGE_DRIVER=cloudinary  → Cloudinary (needed on serverless hosting)
 */

export type UploadFolder = "products" | "reviews";

export interface StoredImage {
  url: string;
  key: string;
  width: number;
  height: number;
}

export class UploadError extends Error {}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "heif"]);

export function uploadDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR?.trim() || "./storage/uploads");
}

function driver(): "local" | "cloudinary" {
  return process.env.STORAGE_DRIVER?.trim() === "cloudinary" ? "cloudinary" : "local";
}

async function processImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const meta = await sharp(input, { limitInputPixels: 50_000_000 })
    .metadata()
    .catch(() => null);
  if (!meta) throw new UploadError("The file is not a valid image.");
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UploadError("Unsupported image format. Use JPG, PNG, WebP or AVIF.");
  }
  const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function saveLocal(folder: UploadFolder, image: { data: Buffer; width: number; height: number }): Promise<StoredImage> {
  const now = new Date();
  const dir = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${randomToken(12).toLowerCase().replace(/[^a-z0-9]/g, "x")}.webp`;
  const key = `${dir}/${name}`;
  await mkdir(path.join(/*turbopackIgnore: true*/ uploadDir(), dir), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ uploadDir(), key), image.data, { flag: "wx" });
  return { url: `/media/${key}`, key: `local:${key}`, width: image.width, height: image.height };
}

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !apiKey || !secret) {
    throw new UploadError("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).");
  }
  return { cloud, apiKey, secret };
}

function cloudinarySignature(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

async function saveCloudinary(folder: UploadFolder, image: { data: Buffer; width: number; height: number }): Promise<StoredImage> {
  const { cloud, apiKey, secret } = cloudinaryConfig();
  const params = { folder: `deenbox/${folder}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(image.data)], { type: "image/webp" }), "image.webp");
  form.set("api_key", apiKey);
  form.set("folder", params.folder);
  form.set("timestamp", params.timestamp);
  form.set("signature", cloudinarySignature(params, secret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as { secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message?: string } };
  if (!res.ok || !body.secure_url || !body.public_id) {
    throw new UploadError(`Cloudinary upload failed: ${body.error?.message ?? res.status}`);
  }
  return {
    url: body.secure_url,
    key: `cloudinary:${body.public_id}`,
    width: body.width ?? image.width,
    height: body.height ?? image.height,
  };
}

export async function saveImage(file: File, folder: UploadFolder): Promise<StoredImage> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Image is too large (max 8 MB).");
  const image = await processImage(Buffer.from(await file.arrayBuffer()));
  return driver() === "cloudinary" ? saveCloudinary(folder, image) : saveLocal(folder, image);
}

/** Deletes a stored image. Failures are logged, not thrown. */
export async function deleteImage(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    if (key.startsWith("local:")) {
      const rel = key.slice("local:".length);
      if (!/^[a-z]+\/\d{4}\/\d{2}\/[a-z0-9]+\.webp$/.test(rel)) return;
      await unlink(path.join(/*turbopackIgnore: true*/ uploadDir(), rel));
    } else if (key.startsWith("cloudinary:")) {
      const { cloud, apiKey, secret } = cloudinaryConfig();
      const params = { public_id: key.slice("cloudinary:".length), timestamp: String(Math.floor(Date.now() / 1000)) };
      const form = new FormData();
      form.set("public_id", params.public_id);
      form.set("timestamp", params.timestamp);
      form.set("api_key", apiKey);
      form.set("signature", cloudinarySignature(params, secret));
      await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/destroy`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
    }
  } catch (error) {
    console.error("[storage] delete failed", key, error instanceof Error ? error.message : error);
  }
}

/**
 * Deletes the stored images no product image or review points to any more. Image
 * keys come back from the admin forms, so a key may be shared by several rows
 * (e.g. copied to another product); its file stays until the last row is gone.
 */
export async function deleteUnusedImages(keys: (string | null | undefined)[]): Promise<void> {
  const candidates = [...new Set(keys.filter((k): k is string => !!k))];
  if (candidates.length === 0) return;
  const [productImages, reviews] = await Promise.all([
    prisma.productImage.findMany({ where: { storageKey: { in: candidates } }, select: { storageKey: true } }),
    prisma.review.findMany({ where: { imageKey: { in: candidates } }, select: { imageKey: true } }),
  ]);
  const inUse = new Set<string | null>([...productImages.map((i) => i.storageKey), ...reviews.map((r) => r.imageKey)]);
  await Promise.all(candidates.filter((k) => !inUse.has(k)).map((k) => deleteImage(k)));
}
