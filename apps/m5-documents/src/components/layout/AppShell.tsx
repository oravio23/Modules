import { NavLink, Outlet } from "react-router-dom";
import { FileStack, Upload, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/oravio/Logo";

// Relative-looking paths, not "/m5/..." — BrowserRouter's basename="/m5" (set in App.tsx)
// automatically prepends itself to every absolute `to`, so hardcoding the prefix here would
// double it up into "/m5/m5/queue".
const NAV_ITEMS = [
  { to: "/", label: "Upload", icon: Upload, end: true },
  { to: "/queue", label: "Queue", icon: FileStack, end: false },
  { to: "/profiles", label: "Profiles", icon: Wrench, end: false },
];

/**
 * The header logo is a full-page link (not a client-side route) back to the hub at the
 * origin root — this module and the shell are separate SPA bundles sharing one Supabase
 * session under the path-rewrite deploy model, not routes within the same app.
 */
export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--panel)]/75">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-[clamp(18px,4vw,56px)]">
          <div className="flex items-center gap-4">
            <a href="/">
              <Logo className="h-10 w-auto sm:h-10" />
            </a>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">Document Intelligence</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-[clamp(18px,4vw,56px)] py-6">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--line)] py-3">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-[clamp(18px,4vw,56px)] text-xs text-[var(--muted)]">
          <span>Pilot build — every extraction requires human review before use.</span>
          <span>Synthetic fixtures only. No real client data.</span>
        </div>
      </footer>
    </div>
  );
}
