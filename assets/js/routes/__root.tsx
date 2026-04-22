import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { A11yAnnouncer } from "@/lib/a11y/announcer";
import { useFocusOnRouteChange } from "@/lib/a11y/use-focus-on-route-change";

interface RouterContext {
  queryClient: QueryClient;
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
        <Outlet />
      </div>
    </A11yAnnouncer>
  );
}
