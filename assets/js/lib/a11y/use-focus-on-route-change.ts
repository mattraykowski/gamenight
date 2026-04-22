import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAnnounce } from "./announcer";

/**
 * On every SPA navigation, focuses the destination route's primary
 * heading (`[data-route-heading]`) and announces its text via the
 * polite aria-live region. Satisfies the constitution's Principle IV
 * route-change focus management requirement.
 *
 * Does NOT fire on initial page load — the browser handles initial
 * focus. Only subsequent client-side navigations trigger the effect.
 *
 * MUST be rendered inside an <A11yAnnouncer>.
 */
export function useFocusOnRouteChange(): void {
  const router = useRouter();
  const announce = useAnnounce();

  useEffect(() => {
    return router.subscribe("onResolved", () => {
      // Defer one microtask so the new route's DOM is guaranteed to be mounted
      // before we query for the heading.
      queueMicrotask(() => {
        const heading = document.querySelector<HTMLElement>("[data-route-heading]");
        if (!heading) return;
        heading.focus();
        const text = heading.textContent?.trim();
        if (text) announce(text);
      });
    });
  }, [router, announce]);
}
