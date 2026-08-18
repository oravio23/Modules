import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Search } from "lucide-react";
import { Logo } from "@/components/oravio/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/lib/auth/AuthProvider";
import { signOut } from "@/lib/auth/signOut";
import { useIsPlatformAdmin } from "@/lib/auth/useIsPlatformAdmin";
import { CommandMenu } from "./CommandMenu";

/**
 * Shared chrome so every module's header stays identical to the hub's — this file is the
 * one place that changes if branding ever does. Module apps get their own copy of this
 * pattern (see apps/_template); keep them in sync by hand for now since only the shell
 * needs the account/org menu today.
 */
export function SiteHeader() {
  const user = useUser();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const { isStaff } = useIsPlatformAdmin();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--app-line)] bg-[var(--app-bg-translucent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-[clamp(18px,4vw,56px)] py-3">
        <Link to="/hub" className="flex items-center">
          <Logo tone="dark" />
        </Link>

        {user && (
          <div className="flex items-center gap-2">
            <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
            <Button
              variant="outline"
              size="sm"
              className="hidden items-center gap-1.5 border-[var(--app-line)] bg-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] sm:inline-flex"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">⌘K</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/account">
                    <UserIcon className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/org">Organization</Link>
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Staff console</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
