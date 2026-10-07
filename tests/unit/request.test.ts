import { describe, expect, it } from "vitest";
import { readFormData, readJsonBody } from "@/lib/request";

/** A request whose body arrives in chunks with no Content-Length, like a chunked upload. */
function chunkedRequest(contentType: string, chunks: Uint8Array[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
    duplex: "half",
  } as RequestInit);
}

async function multipart(form: FormData): Promise<{ type: string; bytes: Uint8Array }> {
  const res = new Response(form);
  return { type: res.headers.get("content-type")!, bytes: new Uint8Array(await res.arrayBuffer()) };
}

describe("readFormData", () => {
  it("reads a form within the limit", async () => {
    const form = new FormData();
    form.set("folder", "products");
    form.set("file", new File([new Uint8Array(1000)], "a.png", { type: "image/png" }));
    const { type, bytes } = await multipart(form);
    const read = await readFormData(chunkedRequest(type, [bytes.slice(0, 100), bytes.slice(100)]), 10_000);
    expect(read?.get("folder")).toBe("products");
    expect((read?.get("file") as File).size).toBe(1000);
  });

  it("stops reading a chunked body without Content-Length at the limit", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(50_000)], "big.png", { type: "image/png" }));
    const { type, bytes } = await multipart(form);
    const chunks = Array.from({ length: Math.ceil(bytes.length / 4096) }, (_, i) => bytes.slice(i * 4096, (i + 1) * 4096));
    expect(await readFormData(chunkedRequest(type, chunks), 10_000)).toBeUndefined();
  });

  it("rejects bodies that are not multipart", async () => {
    expect(await readFormData(chunkedRequest("application/json", [new TextEncoder().encode("{}")]), 10_000)).toBeUndefined();
  });
});

describe("readJsonBody", () => {
  it("reads JSON split across chunks, including multi-byte characters", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ name: "আব্দুল্লাহ" }));
    const read = await readJsonBody(chunkedRequest("application/json", [bytes.slice(0, 13), bytes.slice(13)]));
    expect(read).toEqual({ name: "আব্দুল্লাহ" });
  });

  it("returns undefined past the limit", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ pad: "x".repeat(100) }));
    expect(await readJsonBody(chunkedRequest("application/json", [bytes]), 50)).toBeUndefined();
  });
});
