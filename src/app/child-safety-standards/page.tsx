import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import {
  metadataKeywords,
  seoKeywordGroups,
  siteKeywords,
  siteName,
  siteUrl,
  supportEmail,
} from "@/lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/child-safety-standards`,
  },
  description:
    "TheTattooCore child safety standards, reporting paths, and escalation policy for child sexual abuse and exploitation concerns.",
  keywords: metadataKeywords(
    siteKeywords,
    seoKeywordGroups.childSafety,
    seoKeywordGroups.help,
  ),
  title: "Child Safety Standards",
};

const standards = [
  {
    body:
      "TheTattooCore is for adults 18 and older. Content involving child sexual abuse or exploitation, sexualized minors, grooming, trafficking, solicitation, or attempts to sexualize a minor is prohibited.",
    title: "Zero Tolerance",
  },
  {
    body:
      "Members can report posts, profiles, comments, DMs, Stuff, Gigs, Merch, and Help content from the app. The report reason list includes minor safety concerns so moderation can prioritize urgent review.",
    title: "In-App Reporting",
  },
  {
    body:
      "Moderators may remove content, restrict accounts, preserve evidence needed for review, and escalate serious child safety concerns to the appropriate regional or national authorities when required by law.",
    title: "Review And Escalation",
  },
  {
    body:
      "Images, videos, messages, profile details, verification materials, and related reports may be reviewed only where needed for safety, legal, abuse-prevention, or moderation purposes.",
    title: "Evidence Handling",
  },
  {
    body:
      "Urgent child safety or exploitation concerns can be sent to Support. Include the username, link, screenshot, or context that helps the team find the content quickly.",
    title: "Safety Contact",
  },
] as const;

export default function ChildSafetyStandardsPage() {
  return (
    <main className="ttc-page min-h-screen px-4 py-8">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${siteName} home`}>
            <LogoLockup />
          </Link>
          <Link
            className="ttc-surface rounded-md border px-4 py-2 text-sm font-semibold"
            href="/support"
          >
            Support
          </Link>
        </div>

        <div className="ttc-card ttc-page-panel rounded-lg border border-[var(--card-rim)] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[var(--muted-strong)]">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Child Safety Standards</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            These standards explain how TheTattooCore handles child sexual
            abuse and exploitation concerns. The app is 18+ only, but every
            report involving possible minor safety risk is treated as urgent.
          </p>

          <div className="mt-7 space-y-5">
            {standards.map((standard) => (
              <section key={standard.title}>
                <h2 className="text-lg font-bold">{standard.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {standard.body}
                </p>
              </section>
            ))}
          </div>

          <section className="ttc-surface mt-7 rounded-md border p-4 text-sm leading-6 text-[var(--muted)]">
            <h2 className="text-lg font-bold text-[var(--text)]">
              Contact Support
            </h2>
            <p className="mt-2">
              For urgent safety, exploitation, or account concerns, email{" "}
              <a className="font-semibold underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          </section>

          <div className="mt-4 flex flex-col gap-2 text-sm font-semibold sm:flex-row">
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href="/support"
            >
              Support
            </Link>
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href="/terms"
            >
              Terms
            </Link>
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href="/privacy"
            >
              Privacy
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
