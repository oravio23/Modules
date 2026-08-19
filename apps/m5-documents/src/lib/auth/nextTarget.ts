/**
 * Where to send someone after they authenticate.
 *
 * The `next` value is produced by ProtectedRoute/RequireModule when a signed-out user is
 * bounced off a deep link, and in production it is almost always a MODULE path like
 * `/m5/review/abc`. Modules are separate Vite apps served behind a rewrite (vercel.json) or
 * the dev proxy — the shell's router does not own those paths. Handing one to react-router's
 * navigate()/<Navigate> pushes state inside the shell bundle, matches the catch-all route,
 * and renders "Page not found" with the module URL sitting in the address bar. Every other
 * cross-app link in the codebase (CommandMenu, RequireModule, RequireStaff, ProtectedRoute)
 * already uses window.location.assign for exactly this reason; these helpers make the three
 * post-auth redirects agree with that convention.
 */

/** Route prefixes the shell's own router owns — see apps/shell/src/App.tsx. */
const SHELL_ROUTE_PREFIXES = ["/hub", "/account", "/org", "/admin", "/no-access", "/auth"];

/**
 * Normalises an untrusted `next` query parameter to a safe, same-origin absolute path.
 *
 * A bare `startsWith("/")` check is NOT enough once the value can reach
 * window.location.assign: `//evil.com` and `/\evil.com` also start with "/" but are
 * protocol-relative URLs that browsers resolve to a different origin. Anything that isn't a
 * plain same-origin path falls back to /hub.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/hub";
  if (!next.startsWith("/")) return "/hub";
  // Protocol-relative ("//host") and its backslash variant ("/\host"), which some browsers
  // normalise to "//host".
  if (next.startsWith("//") || next.startsWith("/\\")) return "/hub";
  return next;
}

/** True when the shell's own react-router can render this path. */
export function isShellRoute(path: string): boolean {
  return SHELL_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Send the user to `next`, picking the right navigation mechanism: react-router for routes
 * the shell owns (no full reload), a real document navigation for module paths so the
 * rewrite/proxy is actually consulted.
 */
export function goToNext(
  next: string | null | undefined,
  navigate: (to: string, options?: { replace?: boolean }) => void,
): void {
  const target = safeNextPath(next);
  if (isShellRoute(target)) {
    navigate(target, { replace: true });
    return;
  }
  window.location.assign(target);
}
