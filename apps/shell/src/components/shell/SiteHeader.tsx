import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
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

/**
 * Shared chrome so every module's header stays identical to the hub's — this file is the
 * one place that changes if branding ever does. Module apps get their own copy of this
 * pattern (see apps/_template); keep them in sync by hand for now since only the shell
 * needs the account/org menu today.
 */
export function SiteHeader() {
  const user = useUser();
  const navigate = useNavigate();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-[clamp(18px,4vw,56px)] py-3">
        <Link to="/hub" className="flex items-center">
          <Logo />
        </Link>

        {user && (
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
