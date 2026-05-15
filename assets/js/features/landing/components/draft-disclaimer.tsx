import { siteConfig } from "@/lib/config/site-config";

const DISCLAIMER_BODY =
  "This document is a draft we publish for transparency. It is not legal advice. We will publish a final, counsel-reviewed version before GameNight reaches general availability.";

export function DraftDisclaimer() {
  return (
    <section
      role="status"
      data-testid="draft-disclaimer"
      className="my-6 rounded-md border-2 border-secondary/50 bg-card/70 p-4 text-sm leading-relaxed"
    >
      <p>
        <strong className="font-semibold">Draft, not legal advice.</strong>{" "}
        {DISCLAIMER_BODY} Questions? Email{" "}
        <a
          href={`mailto:${siteConfig.contactEmail}`}
          className="font-medium underline underline-offset-2"
        >
          {siteConfig.contactEmail}
        </a>
        .
      </p>
    </section>
  );
}
