import { Link } from "@tanstack/react-router";
import { Calendar as CalendarIcon, Dices, LayoutDashboard, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", to: "/calendar", icon: CalendarIcon },
  { label: "All Games", to: "/games", icon: Dices },
] as const;

/**
 * Adventurer's Journal — left-side primary navigation rail.
 *
 * Per the Stitch dashboard reference: a 256px wide sticky column
 * with a user-context block, a "New Quest" primary CTA, and a
 * vertical nav. Hidden below the `md` breakpoint — the existing
 * `<MobileNav>` sheet covers the small-screen case.
 *
 * Active-link styling uses `bg-primary text-primary-foreground` so
 * the current route reads like a stamped wax seal on the journal's
 * page (forest green on parchment) — same visual language as the
 * primary button.
 */
export function AppSidebar() {
  const auth = useOptionalAuth();
  if (!auth?.isAuthenticated || !auth.user) return null;

  return (
    <aside
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col border-r-2 border-secondary/30 bg-sidebar py-2 text-sidebar-foreground md:flex"
      data-testid="app-sidebar"
    >
      <div className="px-6 pt-8">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card text-base font-semibold text-secondary"
          >
            {auth.user.email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p
              className="truncate font-serif text-sm font-semibold leading-tight"
              data-testid="app-sidebar-email"
            >
              {auth.user.email}
            </p>
            <p className="text-xs text-muted-foreground">Game Master</p>
          </div>
        </div>
        <Button
          asChild
          className="mt-4 w-full gap-2 uppercase tracking-wider"
          data-testid="app-sidebar-new-quest"
        >
          <Link to="/games/new">
            <Plus className="size-4" aria-hidden />
            New Quest
          </Link>
        </Button>
      </div>

      <nav aria-label="Primary" className="mt-8 flex flex-col gap-0.5 px-2">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            search={link.to === "/dashboard" ? {} : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-2.5 font-serif text-sm text-foreground transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              // Active state stamps the link onto the page like a
              // wax seal pressed into parchment: forest-green bg,
              // gilded gold text, inset shadow for the "pressed-in"
              // depth.
              "aria-[current=page]:bg-primary-container aria-[current=page]:text-tertiary-container aria-[current=page]:shadow-inner aria-[current=page]:hover:text-tertiary-container",
            )}
            activeProps={{ "aria-current": "page" }}
            data-testid={`app-sidebar-link-${link.to.replace(/\//g, "-").replace(/^-/, "")}`}
          >
            <link.icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
