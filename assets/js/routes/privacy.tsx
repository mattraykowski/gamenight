import { createFileRoute } from "@tanstack/react-router";
import { PrivacyDraft } from "@/features/landing/content/privacy-draft";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { buildRouteMeta, privacyMeta } from "@/features/landing/content/meta";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: () => ({
    meta: buildRouteMeta(privacyMeta, "/privacy", "article"),
  }),
});

export function PrivacyRoute() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <PrivacyDraft />
      </div>
      <MarketingFooter />
    </main>
  );
}
