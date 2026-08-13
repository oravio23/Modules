/**
 * Get a real `ArrayBuffer` view of a `Uint8Array`'s contents.
 *
 * `Uint8Array.prototype.buffer` is typed as `ArrayBufferLike` (i.e.
 * `ArrayBuffer | SharedArrayBuffer`) in current TS/DOM lib definitions, which
 * a lot of browser and library APIs (Blob, mammoth, UTIF) don't accept. Every
 * Uint8Array in this codebase is always backed by a plain ArrayBuffer (we
 * only ever create them via `new Uint8Array(...)`, `TextEncoder`, or
 * `arrayBuffer()` results — never `SharedArrayBuffer`), so the cast is safe;
 * this helper documents that once instead of repeating it at every call site.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
