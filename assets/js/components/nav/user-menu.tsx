import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/auth/hooks";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Dropdown menu rendered on the right side of the nav bar when the
 * GM is authenticated. Shows the signed-in email as a label and a
 * Sign out item; structured so future account / preferences items
 * can slot in without touching callers.
 */
export function UserMenu() {
  const auth = useAuth();
  const signOut = useSignOut();
  const navigate = useNavigate();

  if (!auth.user) return null;

  async function onSignOut() {
    try {
      await signOut.mutateAsync();
      await navigate({ to: "/" });
    } catch {
      // Failed sign-out is rare (a network hiccup) — the user's
      // session is still valid so retrying from the same menu works.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          data-testid="user-menu-trigger"
          aria-label={`Account menu for ${auth.user.email}`}
        >
          <span className="max-w-[180px] truncate text-sm">{auth.user.email}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="truncate">{auth.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onSignOut}
          data-testid="user-menu-sign-out"
          disabled={signOut.isPending}
        >
          {signOut.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
