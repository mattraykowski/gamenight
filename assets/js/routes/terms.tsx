import { createFileRoute } from "@tanstack/react-router";
import { TermsDraft } from "@/features/landing/content/terms-draft";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { buildRouteMeta, termsMeta } from "@/features/landing/content/meta";

export const Route = createFileRoute("/terms")({
  component: TermsRoute,
  head: () => ({
    meta: buildRouteMeta(termsMeta, "/terms", "article"),
  }),
});

export function TermsRoute() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <TermsDraft />
      </div>
      <MarketingFooter />
    </main>
  );
}
