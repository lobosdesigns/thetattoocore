import Link from "next/link";
import type { Metadata } from "next";
import { HelpCenterSearch } from "./help-center-search";
import { LogoLockup } from "../logo-mark";
import { getHelpArticle } from "@/lib/help-center";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore Help Center for account setup, verification, bookings, ads, Merch, Stuff, Gigs, Stories, DMs, and safety basics.",
  title: "Help Center",
};

const launchGuideSlugs = [
  "getting-started",
  "artist-profile-shop-links",
  "verification-documents",
  "posting-stories-dms",
  "booking-appointments",
  "merch-products-orders",
  "seller-payouts-payment-safety",
  "ads-and-credits",
  "privacy-safety-support",
] as const;

const launchGuides = launchGuideSlugs.flatMap((slug) => {
  const article = getHelpArticle(slug);

  return article ? [article] : [];
});

export default function HelpCenterPage() {
  return (
    <main className="ttc-page min-h-screen px-4 py-8">
      <article className="mx-auto max-w-5xl">
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

        <section className="ttc-card ttc-page-panel rounded-lg border border-[var(--card-rim)] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[var(--muted-strong)]">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Help Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Tutorials, FAQ, and member support for using TheTattooCore. Start
            with the getting-started guide, then use search for profiles,
            verification, bookings, ads, Merch, Stuff, Gigs, Stories, DMs, and
            safety.
          </p>

          <section className="mt-7 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_90%,var(--gold)_7%)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">
                  Launch setup checklist
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Start with these guides first
                </h2>
              </div>
              <span className="w-fit rounded-md border border-[var(--card-rim)] px-3 py-1 text-xs font-bold text-[var(--muted-strong)]">
                {launchGuides.length} priority guides
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {launchGuides.map((guide) => (
                <Link
                  className="ttc-surface rounded-lg border border-[var(--card-rim)] p-4 hover:border-[var(--gold)]"
                  href={`/help/${guide.slug}`}
                  key={guide.slug}
                >
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    {guide.category}
                  </p>
                  <h3 className="mt-2 text-base font-black">{guide.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                    {guide.description}
                  </p>
                  {guide.tutorialMedia?.length ? (
                    <p className="mt-3 text-xs font-bold text-[var(--muted-strong)]">
                      {guide.tutorialMedia.length} screenshot/video tutorial slots
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>

          <HelpCenterSearch />

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">Article Comments</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Signed-in members can ask deeper questions on guide pages.
              Moderators can answer, pin official replies, hide unsafe
              comments, and turn repeated questions into better FAQ entries.
            </p>
          </section>

          <div className="mt-7 flex flex-col gap-3 text-sm font-semibold sm:flex-row">
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href="/support"
            >
              Contact support
            </Link>
            <a
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href={`mailto:${supportEmail}`}
            >
              {supportEmail}
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
