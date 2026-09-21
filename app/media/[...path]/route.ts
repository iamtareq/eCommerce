import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "@/lib/storage";

export const dynamic = "force-dynamic";

const SEGMENT = /^[a-z0-9]+(\.webp)?$/;

/**
 * GET /media/... — serves images saved by the local storage driver.
 * Files are immutable (random names), so they are cached for a year.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  if (
    !segments?.length ||
    segments.length > 4 ||
    !segments.every((s) => SEGMENT.test(s)) ||
    !segments[segments.length - 1]!.endsWith(".webp")
  ) {
    return new Response("Not found", { status: 404 });
  }
  const root = uploadDir();
  const file = path.resolve(/*turbopackIgnore: true*/ root, ...segments);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
