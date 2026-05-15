import { siteConfig } from "@/lib/config/site-config";

export interface RouteMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImagePath: string;
}

/**
 * Returns the TanStack Router `head().meta` array for a marketing-style
 * route. Composes Open Graph + Twitter Card meta from the route's
 * `RouteMeta` so the unfurl on Discord / Slack / iMessage uses
 * absolute URLs (relative paths trip the unfurl bots — see
 * contracts/route-contracts.md).
 *
 * `routePath` is the absolute pathname (e.g. `"/"`, `"/privacy"`).
 * `ogType` is `"website"` for the landing page and `"article"` for
 * the legal stubs, per the contract.
 */
export function buildRouteMeta(
  meta: RouteMeta,
  routePath: string,
  ogType: "website" | "article",
): Array<Record<string, string | number>> {
  const absoluteUrl = `${siteConfig.siteOrigin}${routePath}`;
  const absoluteImage = `${siteConfig.siteOrigin}${meta.ogImagePath}`;
  return [
    { title: meta.title },
    { name: "description", content: meta.description },
    { property: "og:title", content: meta.ogTitle },
    { property: "og:description", content: meta.ogDescription },
    { property: "og:type", content: ogType },
    { property: "og:url", content: absoluteUrl },
    { property: "og:image", content: absoluteImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: meta.ogTitle },
    { name: "twitter:description", content: meta.ogDescription },
    { name: "twitter:image", content: absoluteImage },
  ];
}

const SHARED_OG_IMAGE_PATH = "/images/og/landing.png";

export const landingMeta: RouteMeta = {
  title: "GameNight — Run your tabletop campaign with confidence",
  description:
    "GameNight helps Game Masters organize tabletop campaigns: register games, invite players, schedule the month, and keep your fellowship in sync.",
  ogTitle: "GameNight — Run your tabletop campaign with confidence",
  ogDescription:
    "Register your game, invite your players, and schedule the month. GameNight keeps every campaign on the same page.",
  ogImagePath: SHARED_OG_IMAGE_PATH,
};

export const privacyMeta: RouteMeta = {
  title: "Privacy Policy — GameNight",
  description:
    "Draft privacy policy for GameNight. We publish this for transparency; the final version will be counsel-reviewed before general availability.",
  ogTitle: "Privacy Policy — GameNight",
  ogDescription:
    "Draft privacy policy for GameNight, published for transparency ahead of a counsel-reviewed final version.",
  ogImagePath: SHARED_OG_IMAGE_PATH,
};

export const termsMeta: RouteMeta = {
  title: "Terms of Service — GameNight",
  description:
    "Draft terms of service for GameNight. We publish this for transparency; the final version will be counsel-reviewed before general availability.",
  ogTitle: "Terms of Service — GameNight",
  ogDescription:
    "Draft terms of service for GameNight, published for transparency ahead of a counsel-reviewed final version.",
  ogImagePath: SHARED_OG_IMAGE_PATH,
};
