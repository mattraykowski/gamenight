import { siteConfig } from "@/lib/config/site-config";
import { DraftDisclaimer } from "@/features/landing/components/draft-disclaimer";

const LAST_REVISED = "2026-05-06";

const ContactLink = () => (
  <a
    href={`mailto:${siteConfig.contactEmail}`}
    className="font-medium underline underline-offset-2"
  >
    {siteConfig.contactEmail}
  </a>
);

export function PrivacyDraft() {
  return (
    <article className="prose-gn">
      <h1
        data-route-heading
        tabIndex={-1}
        className="font-serif text-4xl font-bold tracking-tight"
      >
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last revised: {LAST_REVISED} (draft)
      </p>

      <DraftDisclaimer />

      <p className="mt-4">
        GameNight is a service that helps Game Masters organize tabletop
        campaigns. This Privacy Policy explains what information we collect
        when you use GameNight, how we use it, and the rights you have
        over it.
      </p>

      <Section title="What we collect">
        <p>
          <strong>Account information.</strong> When you register, we collect
          your email address and a securely hashed password. If you set a
          display name, we store that too. We do not store passwords in
          plain text.
        </p>
        <p>
          <strong>Content you create.</strong> When you use GameNight, you
          create games, characters, schedules, availability, and messages.
          We store this so that you, your players, and the people you have
          invited can see it. You own this content (see our Terms of
          Service).
        </p>
        <p>
          <strong>Automatic technical information.</strong> When you use
          GameNight, our servers receive standard request information —
          your IP address, the type of browser and device you are using,
          and which pages you requested. We use this for operational and
          security purposes and do not combine it with advertising
          profiles.
        </p>
        <p>
          We do <strong>not</strong> collect: precise location data,
          biometric information, contact lists, or browsing history outside
          GameNight.
        </p>
      </Section>

      <Section title="How we use what we collect">
        <ul className="list-disc pl-6">
          <li>
            Run the service — so that you can sign in, your players can see
            the schedule, and notifications get delivered.
          </li>
          <li>
            Communicate with you — about your account, security alerts, and
            service updates.
          </li>
          <li>
            Keep the service safe — investigate abuse, fraud, and harmful
            activity.
          </li>
          <li>
            Improve the service — fix bugs, understand which features
            people use, plan what to build next.
          </li>
        </ul>
        <p>
          We do not use your information to build advertising profiles, and
          we do not sell your information to anyone.
        </p>
      </Section>

      <Section title="How we share what we collect">
        <p className="font-semibold">
          We do not sell your personal information.
        </p>
        <p>We share information only with:</p>
        <ul className="list-disc pl-6">
          <li>
            <strong>Service providers</strong> that help us run GameNight
            — for example, hosting providers and email-delivery services.
            These providers act on our behalf and may not use the
            information for anything else.
          </li>
          <li>
            <strong>Law enforcement and others, where required by law</strong>
            {" "}— for example, a valid subpoena or a court order. Where we
            are not legally prohibited from telling you, we will.
          </li>
          <li>
            <strong>People you have invited</strong> — that is the whole
            point of inviting them. The players in your game see the
            schedule you publish; the GM of a game you join sees your
            availability.
          </li>
        </ul>
      </Section>

      <Section title="Cookies and similar technologies">
        <p>
          We use cookies for one purpose: keeping you signed in. The cookie
          is marked <code>HttpOnly</code>, <code>Secure</code>, and{" "}
          <code>SameSite=Lax</code> so it is not exposed to JavaScript,
          only sent over HTTPS, and not sent in cross-site requests. We do
          not use advertising cookies, cross-site trackers, or third-party
          analytics that profile users.
        </p>
        <p>
          If your browser blocks the auth cookie, GameNight cannot keep
          you signed in.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You have rights over your personal information. Depending on
          where you live, the law may give you the rights to:
        </p>
        <ul className="list-disc pl-6">
          <li><strong>Access</strong> the information we hold about you.</li>
          <li><strong>Correct</strong> inaccurate information.</li>
          <li><strong>Delete</strong> your information.</li>
          <li>
            <strong>Export</strong> a copy of your information in a
            portable format.
          </li>
          <li>
            <strong>Object</strong> to certain uses, or{" "}
            <strong>restrict</strong> processing.
          </li>
        </ul>
        <p>
          You can exercise these rights at any time by emailing{" "}
          <ContactLink />. We will reply within a reasonable time and will
          not charge you for ordinary requests.
        </p>
        <p>
          If you are in the European Economic Area, the United Kingdom, or
          Switzerland, you also have the right to lodge a complaint with
          your local data-protection authority. If you are a California
          resident, the California Consumer Privacy Act and California
          Privacy Rights Act give you additional rights, including the
          right to know what personal information we have collected and the
          right to delete it; the mechanisms above honor those rights.
        </p>
      </Section>

      <Section title="How long we keep your information">
        <p>
          We keep your account information for as long as your account is
          open. If you ask us to delete your account, we delete your
          account information within thirty days, except where we are
          legally required to keep records longer (for example, to respond
          to a tax audit).
        </p>
        <p>
          We may keep aggregated, de-identified information indefinitely
          for operational and analytical purposes.
        </p>
      </Section>

      <Section title="Children">
        <p>
          GameNight is not directed to children under 13. We do not
          knowingly collect personal information from children under 13.
          If you believe a child has created an account, email{" "}
          <ContactLink /> and we will remove the account.
        </p>
      </Section>

      <Section title="International transfers">
        <p>
          GameNight is operated from the United States. If you use
          GameNight from outside the United States, you understand that
          your information will be transferred to and processed in the
          United States. We will publish detail about transfer safeguards
          in the final Privacy Policy.
        </p>
      </Section>

      <Section title="How we keep your information safe">
        <ul className="list-disc pl-6">
          <li>All traffic is encrypted in transit (HTTPS).</li>
          <li>Passwords are hashed with a modern, slow algorithm.</li>
          <li>
            Access to production data is restricted to a small number of
            staff and is logged.
          </li>
          <li>
            We will notify affected users of any security incident that
            materially affects their information, in accordance with
            applicable law.
          </li>
        </ul>
        <p>
          No service can promise perfect security. If you suspect your
          account has been compromised, email <ContactLink /> immediately.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We will revise this policy. When we do, we will update the date
          at the top of this page. For material changes, we will notify
          signed-in users by email at least seven days before the change
          takes effect.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy? Email <ContactLink />. You can also
          find the GameNight project at our community link in the page
          footer.
        </p>
      </Section>

      <p className="mt-10 text-sm italic text-muted-foreground">
        Reminder: this document is a draft. The final, counsel-reviewed
        Privacy Policy will replace it before GameNight reaches general
        availability.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
