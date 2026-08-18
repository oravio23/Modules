import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Building2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModuleIcon } from "@/components/oravio/ModuleIcon";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { signOut } from "@/lib/auth/signOut";

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ⌘K / Ctrl+K module switcher — the cmdk-based `command` primitive was already vendored
 * into every app by sync-ui.mjs but nothing used it. Controlled from SiteHeader (which owns
 * the global keydown listener and the visible ⌘K button) rather than managing its own open
 * state, so both entry points — the keyboard shortcut and the button — drive the same
 * state instead of the button needing to fake a keyboard event to reach an internal one.
 *
 * Module rows navigate with a full page load (`window.location.assign`), not react-router's
 * `navigate()` — each module is a separate app mounted at its own path via a proxy/rewrite
 * (see vite.config.ts's dev proxy and vercel.json), not a route this shell's own router
 * defines. Account/Organization/sign out ARE real shell routes, so those do use `navigate()`.
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();
  const { modules } = useEntitlements();
  const setOpen = onOpenChange;

  function goToModule(route: string) {
    setOpen(false);
    window.location.assign(route);
  }

  function goToRoute(path: string) {
    setOpen(false);
    navigate(path);
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Switch module</DialogTitle>
        <Command>
          <CommandInput placeholder="Jump to a module or page…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Modules">
              {modules.map((module) => {
                const openable = module.granted && module.status !== "planned";
                return (
                  <CommandItem
                    key={module.id}
                    disabled={!openable}
                    onSelect={() => openable && goToModule(module.route)}
                  >
                    <ModuleIcon moduleId={module.id} className="mr-2 h-4 w-4" />
                    {module.name}
                    {!openable && (
                      <span className="ml-auto text-xs text-muted-foreground">Not in your package</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Account">
              <CommandItem onSelect={() => goToRoute("/account")}>
                <UserIcon className="mr-2 h-4 w-4" />
                Account
              </CommandItem>
              <CommandItem onSelect={() => goToRoute("/org")}>
                <Building2 className="mr-2 h-4 w-4" />
                Organization
              </CommandItem>
              <CommandItem onSelect={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
