import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/lib/auth/auth-context";
import { NotificationsBell } from "@/features/notifications/components/notifications-bell";
import { UserMenu } from "./user-menu";
import { MobileNav, type MobileNavLink } from "./mobile-nav";

const AUTHED_LINKS: ReadonlyArray<MobileNavLink> = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Calendar", to: "/calendar" },
  { label: "All Games", to: "/games" },
];

/**
 * Top-level navigation chrome mounted once in `__root.tsx`. Visible
 * on every route. Adapts to auth state:
 *
 * - Authenticated: brand → /dashboard, primary links (Dashboard, All
 *   Games), user menu on the right.
 * - Anonymous: brand → /, Sign in + Register buttons on the right.
 *
 * Below the `sm` breakpoint the primary links collapse into a Sheet
 * via `<MobileNav>`; the brand and user menu stay in the header.
 *
 * Uses `useOptionalAuth` rather than `useAuth` so component tests
 * that render a single route without an `<AuthProvider>` don't need
 * to stub the full auth surface.
 */
export function NavBar() {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;

  return (
    <header
      className="sticky top-0 z-40 border-b-2 border-secondary/30 bg-background shadow-[4px_4px_0px_rgba(45,90,39,0.1)]"
      data-testid="nav-bar"
    >
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        {isAuthenticated ? (
          <MobileNav links={[...AUTHED_LINKS]} />
        ) : null}

        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          search={isAuthenticated ? {} : undefined}
          className="font-serif text-2xl italic tracking-tight text-tertiary-container hover:opacity-80"
          data-testid="nav-brand"
        >
          Game Night
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <NotificationsBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" data-testid="nav-sign-in">
                <a href="/sign-in">Sign in</a>
              </Button>
              <Button asChild size="sm" data-testid="nav-register">
                <a href="/register">Register</a>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
