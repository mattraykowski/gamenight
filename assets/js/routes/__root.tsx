import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { A11yAnnouncer } from "@/lib/a11y/announcer";
import { useFocusOnRouteChange } from "@/lib/a11y/use-focus-on-route-change";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { NavBar } from "@/components/nav/nav-bar";
import type { AuthContextValue } from "@/lib/auth/auth-context";

export interface RouterContext {
  queryClient: QueryClient;
  /**
   * Populated at render time by `<RouterProvider context={{ auth }} />`.
   * Optional so tests that render individual routes in isolation — via
   * `renderRoute` — don't have to stub the full auth surface.
   */
  auth?: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function FocusManager() {
  useFocusOnRouteChange();
  return null;
}

function RootLayout() {
  return (
    <A11yAnnouncer>
      <FocusManager />
      <div className="min-h-screen bg-background text-foreground antialiased">
        <NavBar />
        <div className="flex">
          <AppSidebar />
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </A11yAnnouncer>
  );
}
