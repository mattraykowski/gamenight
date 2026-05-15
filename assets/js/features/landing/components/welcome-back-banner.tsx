import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/current-user/hooks";
import { useOptionalAuth } from "@/lib/auth/auth-context";

/**
 * Slim banner shown above the marketing hero for authenticated
 * visitors. Resolves a friendly name from the current-user query
 * (with auth-context email as a synchronous fallback). Renders nothing
 * when the page is mounted without an `<AuthProvider>` (component-test
 * isolation) or for anonymous visitors.
 *
 * Constitution IV / 2.4.11: the banner uses normal flow
 * (`position: relative`); we never sticky/fixed-position it.
 */
export function WelcomeBackBanner() {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  // Hooks must be called unconditionally; gate the render below.
  const { data, isPending, isError } = useCurrentUser();

  if (!isAuthenticated || !auth?.user) return null;

  const showFriendly = !isPending && !isError && data?.email;
  const friendlyName = showFriendly
    ? (data.email.split("@")[0] || "Adventurer")
    : null;

  return (
    <section
      aria-label="Welcome back"
      className="relative border-b border-primary-container/20 bg-primary-fixed/40 px-6 py-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="font-serif text-base text-primary">
          Welcome back
          {friendlyName ? (
            <>
              , <span className="font-semibold">{friendlyName}</span>
            </>
          ) : null}
          . Your dashboard is one click away.
        </p>
        <Button asChild size="default" className="group shrink-0">
          <Link to="/dashboard">
            <span>Go to dashboard</span>
            <ArrowRight
              className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </Link>
        </Button>
      </div>
    </section>
  );
}
