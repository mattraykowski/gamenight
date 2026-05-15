function readEnv(key: string, fallback: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : fallback;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export const siteConfig = {
  siteOrigin: stripTrailingSlash(
    readEnv("VITE_SITE_ORIGIN", "http://localhost:4000"),
  ),
  contactEmail: readEnv("VITE_CONTACT_EMAIL", "hello@example.com"),
  socialUrl: readEnv("VITE_SOCIAL_URL", "https://github.com/"),
} as const;

export type SiteConfig = typeof siteConfig;
