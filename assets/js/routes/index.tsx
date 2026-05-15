import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LandingHero } from "@/features/landing/components/landing-hero";
import { HowItWorks } from "@/features/landing/components/how-it-works";
import { FeatureHighlights } from "@/features/landing/components/feature-highlights";
import { ClosingCta } from "@/features/landing/components/closing-cta";
import { MarketingFooter } from "@/features/landing/components/marketing-footer";
import { WelcomeBackBanner } from "@/features/landing/components/welcome-back-banner";
import { buildRouteMeta, landingMeta } from "@/features/landing/content/meta";

const landingSearchSchema = z.object({
  // Threaded into Register / Sign in CTAs to preserve invitation links
  // that drop the visitor on the marketing page first (FR-011).
  invite: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: landingSearchSchema,
  component: LandingRoute,
  head: () => ({
    meta: buildRouteMeta(landingMeta, "/", "website"),
  }),
});

export function LandingRoute() {
  return (
    <main>
      <WelcomeBackBanner />
      <LandingHero />
      <HowItWorks />
      <FeatureHighlights />
      <ClosingCta />
      <MarketingFooter />
    </main>
  );
}
