/**
 * `EdgeRuntime` is a global injected by Supabase's actual Edge Runtime at serve time (a Deno
 * fork) — it is NOT part of stock Deno's lib types, so referencing it directly would fail
 * `deno check` outside that runtime (e.g. this file's own module scope, or a local editor).
 * A plain `declare const` in a module file (one with imports/exports) stays local to this
 * module rather than augmenting the true global scope, so it can't conflict with whatever
 * ambient type Supabase's own tooling may or may not provide elsewhere.
 *
 * waitUntil() keeps the function's isolate alive until the given promise settles, without
 * making the original caller wait for it — used for the fire-and-forget pipeline-worker
 * invocation, which config.toml's `policy = "oneshot"` can otherwise tear down mid-flight.
 */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** No-op outside the real edge runtime (e.g. under `deno test`), so callers never need
 * their own `typeof EdgeRuntime !== "undefined"` guard. */
export function waitUntil(promise: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(promise);
  }
}
