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

export function TermsDraft() {
  return (
    <article className="prose-gn">
      <h1
        data-route-heading
        tabIndex={-1}
        className="font-serif text-4xl font-bold tracking-tight"
      >
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last revised: {LAST_REVISED} (draft)
      </p>

      <DraftDisclaimer />

      <p className="mt-4">
        These are the terms that govern your use of GameNight. By creating
        an account or using GameNight, you agree to them. If you do not
        agree, do not use the service.
      </p>

      <Section title="Eligibility">
        <p>
          You must be at least 13 years old to use GameNight. If you are
          between 13 and the age of majority where you live, you may only
          use GameNight with the consent of a parent or guardian.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You are responsible for everything that happens under your
          account. That means:
        </p>
        <ul className="list-disc pl-6">
          <li>Pick a strong password.</li>
          <li>Do not share your password with anyone.</li>
          <li>
            Tell us right away if you think someone else has accessed your
            account.
          </li>
        </ul>
        <p>
          You may close your account at any time by emailing{" "}
          <ContactLink />. When you close your account, we delete your
          account information per our Privacy Policy.
        </p>
      </Section>

      <Section title="What you can and cannot do on GameNight">
        <p>GameNight exists for tabletop game groups. Use it for that.</p>
        <p>You may not:</p>
        <ul className="list-disc pl-6">
          <li>
            Use GameNight to harass, threaten, or abuse other people.
          </li>
          <li>
            Upload content that is illegal where you live, infringes
            someone else&rsquo;s copyright, or violates someone&rsquo;s privacy.
          </li>
          <li>
            Try to disrupt the service — for example, by sending automated
            traffic, attempting to access systems you are not authorized
            to access, or attempting to break the security of the service.
          </li>
          <li>
            Try to access another user&rsquo;s account or impersonate another
            user.
          </li>
          <li>
            Use GameNight to send spam or unsolicited commercial messages.
          </li>
        </ul>
        <p>
          We may suspend or close accounts that violate this section, and
          we will give a brief reason where we reasonably can.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          The games you register, the characters you create, the schedules
          you publish, the messages you write, and any other content you
          put into GameNight is <strong>your content</strong>. You own it.
        </p>
        <p>
          To run the service, you give GameNight the rights it needs to
          host, store, and display your content to the people you have
          invited — for example, the players in your game. We do not use
          your content for anything else, and we do not give it to anyone
          outside the people you invited and our service providers (see
          the Privacy Policy).
        </p>
        <p>
          You are responsible for what you put into GameNight. Make sure
          you have the right to share it with the people you invite.
        </p>
      </Section>

      <Section title="Service availability">
        <p>
          GameNight is provided &ldquo;as is.&rdquo; We will try to keep the service
          running and free of errors, but we do not promise that the
          service will be uninterrupted, error-free, or available at any
          particular time.
        </p>
        <p>
          We may take the service down for maintenance, security, or
          other operational reasons. Where reasonable, we will tell you
          ahead of time.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using GameNight at any time and close your account
          by emailing <ContactLink />.
        </p>
        <p>We may suspend or terminate your account if:</p>
        <ul className="list-disc pl-6">
          <li>You violate these terms.</li>
          <li>We are legally required to do so.</li>
          <li>We stop offering the service.</li>
        </ul>
        <p>
          Where reasonable, we will give you notice and an opportunity to
          export your data before terminating an account.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          To the fullest extent permitted by law, GameNight is provided
          without warranties of any kind, express or implied — including
          implied warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant that the
          service will meet your requirements, or that it will be
          uninterrupted, secure, or error-free.
        </p>
        <p>
          Some jurisdictions do not allow exclusions of certain
          warranties; in those jurisdictions, the exclusions above apply
          to the maximum extent permitted by law.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, GameNight will not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or for lost profits, lost revenue, or lost
          data, arising from or related to your use of the service.
        </p>
        <p>
          The final, counsel-reviewed Terms of Service will set a specific
          liability cap. Until then, this section is a placeholder of
          intent and not a final commitment.
        </p>
      </Section>

      <Section title="Governing law and disputes">
        <p>
          The final, counsel-reviewed Terms of Service will name a
          specific governing law and dispute-resolution venue. We
          anticipate that to be a state in the United States, with the
          specific state confirmed before general availability.
        </p>
        <p>
          We do not include an arbitration clause or a class-action waiver
          in this draft. If the final terms include either, we will call
          out the change explicitly and notify signed-in users.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We will revise these terms. When we do, we will update the date
          at the top of this page. For material changes, we will notify
          signed-in users by email at least seven days before the change
          takes effect.
        </p>
        <p>
          If you keep using GameNight after a change takes effect, you
          agree to the revised terms. If you do not agree, you can close
          your account.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms? Email <ContactLink />. You can also
          find the GameNight project at our community link in the page
          footer.
        </p>
      </Section>

      <p className="mt-10 text-sm italic text-muted-foreground">
        Reminder: this document is a draft. The final, counsel-reviewed
        Terms of Service will replace it before GameNight reaches general
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
