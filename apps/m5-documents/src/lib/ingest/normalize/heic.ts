import type { FileLike, NormalizeResult } from "../types.ts";
import { normalizeImage } from "./image.ts";
import { toArrayBuffer } from "@/lib/bytes";

/** HEIC/HEIF (iPhone photos) — decode to JPEG via WASM, then reuse the same resize/re-encode path as any other photo. Browser-only. */
export async function normalizeHeic(file: FileLike): Promise<NormalizeResult> {
  const { heicTo } = await import("heic-to");
  const sourceBlob = new Blob([toArrayBuffer(file.bytes)], { type: "image/heic" });
  const jpegBlob = await heicTo({ blob: sourceBlob, type: "image/jpeg", quality: 0.92 });
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  return normalizeImage({ filename: file.filename.replace(/\.(heic|heif)$/i, ".jpg"), bytes: jpegBytes, declaredMime: "image/jpeg" });
}
