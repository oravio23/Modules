import type { FileLike, NormalizeResult } from "../types.ts";
import { toArrayBuffer } from "@/lib/bytes";

/** Claude's vision limit: 2576px on the long edge, ~4784 tokens/image at that size (see SKILL.md § Document & File Input). */
export const MAX_LONG_EDGE = 2576;

/** Pure sizing math — separated out so it's testable without a browser Canvas. */
export function computeTargetSize(width: number, height: number, maxLongEdge = MAX_LONG_EDGE): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * JPEG/PNG/WebP/GIF photos and scans — resize to the vision limit and
 * re-encode as JPEG via canvas. Re-encoding also strips EXIF (orientation,
 * GPS, camera metadata) as a side effect, which is what we want: orientation
 * is baked into the re-encoded pixels instead of left as metadata the model
 * or a naive viewer might ignore.
 *
 * Browser-only (uses createImageBitmap + canvas) — exercised by the in-app
 * walkthrough, not vitest. computeTargetSize above carries the unit-tested
 * logic; this function is the thin browser-API wrapper around it.
 */
export async function normalizeImage(file: FileLike): Promise<NormalizeResult> {
  const blob = new Blob([toArrayBuffer(file.bytes)]);
  const bitmap = await createImageBitmap(blob);
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/jpeg", 0.9);
  });
  const bytes = new Uint8Array(await outBlob.arrayBuffer());

  return {
    parts: [{ kind: "page", label: file.filename, bytes, mime: "image/jpeg", width, height }],
    warnings: [],
  };
}
