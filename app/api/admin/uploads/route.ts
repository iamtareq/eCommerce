import { json } from "@/lib/api";
import { authorizeApi } from "@/lib/auth/guard";
import { readFormData } from "@/lib/request";
import { MAX_UPLOAD_BYTES, saveImage, UploadError, type UploadFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";

const FOLDERS: UploadFolder[] = ["products", "reviews"];

/** POST /api/admin/uploads — multipart image upload (owner only). */
export async function POST(request: Request) {
  const auth = await authorizeApi(request, { owner: true });
  if (!auth.ok) return auth.response;

  // The file plus room for the multipart framing and the folder field.
  const maxBytes = MAX_UPLOAD_BYTES + 64 * 1024;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return json({ error: "Image is too large (max 8 MB)." }, 413);

  // Streamed with a hard cap: a chunked request has no Content-Length to check.
  const form = await readFormData(request, maxBytes);
  if (!form) return json({ error: "Invalid upload, or the image is too large (max 8 MB)." }, 400);
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "products") as UploadFolder;
  if (!(file instanceof File)) return json({ error: "No file" }, 400);
  if (!FOLDERS.includes(folder)) return json({ error: "Invalid folder" }, 400);

  try {
    const image = await saveImage(file, folder);
    return json({ image }, 201);
  } catch (error) {
    if (error instanceof UploadError) return json({ error: error.message }, 400);
    console.error("[uploads] failed", error);
    return json({ error: "Upload failed" }, 500);
  }
}
