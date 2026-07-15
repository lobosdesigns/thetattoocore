import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore Help Center for account setup, verification, bookings, ads, Merch, Stuff, Gigs, Stories, DMs, and safety basics.",
  title: "Help Center",
};

const helpCategories = [
  {
    description:
      "Profile setup, profile photo, banner image, bio, website links, social links, shop links, light or dark mode, and account data controls.",
    title: "Account And Profile",
    topics: ["Edit profile", "Profile links", "Privacy basics"],
  },
  {
    description:
      "Artist, studio, and vendor approval steps, what documents to prepare, resubmission basics, and why unlicensed work is not allowed.",
    title: "Verification",
    topics: ["Artist review", "Studio review", "Vendor review"],
  },
  {
    description:
      "Appointment request basics, time-slot setup, deposit expectations, cancellation rules, calendar files, and future calendar connection guidance.",
    title: "Bookings",
    topics: ["Set availability", "Request appointments", "Deposits"],
  },
  {
    description:
      "Creating ads, choosing placements, using ad credits, reading campaign status, and keeping promotions inside the content rules.",
    title: "Advertising",
    topics: ["Create ads", "Ad credits", "Campaign review"],
  },
  {
    description:
      "Merch product setup, seller review, Stuff listings, public browsing, approved buyer interactions, fulfillment, refunds, and dispute basics.",
    title: "Merch And Stuff",
    topics: ["Merch setup", "Stuff listings", "Order support"],
  },
  {
    description:
      "Posting to 4U, Gossip, Gigs, Stories, and DMs, including media uploads, comments, reports, blocking, and no-visible-nudity launch rules.",
    title: "Posting And Safety",
    topics: ["4U and Gossip", "Stories and DMs", "Reports"],
  },
] as const;

const articlePlans = [
  "How to set up an artist profile and link a studio",
  "How to submit artist, studio, or vendor verification",
  "How to create appointment types, time slots, and booking deposits",
  "How to create an ad and use ad credits",
  "How to set up Merch products and handle orders",
  "How to create Stuff listings, Gigs, Stories, and DMs safely",
] as const;

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
            Tutorials, FAQ, and member support for using TheTattooCore. This
            library is starting with the main launch areas first, then will grow
            into screenshot walkthroughs, short clips, and searchable answers.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {helpCategories.map((category) => (
              <section
                className="ttc-surface rounded-lg border border-[var(--card-rim)] p-4"
                key={category.title}
              >
                <h2 className="text-lg font-bold">{category.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {category.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {category.topics.map((topic) => (
                    <span
                      className="rounded-full border border-[var(--card-rim)] px-3 py-1 text-xs font-semibold text-[var(--muted-strong)]"
                      key={topic}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">Tutorial Library</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              These are the first screenshot tutorials planned for launch
              support. Articles will be public when safe, and account-specific
              questions will stay in private support.
            </p>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
              {articlePlans.map((article) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-2"
                  key={article}
                >
                  {article}
                </li>
              ))}
            </ul>
          </section>

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">Article Comments</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Help articles will support signed-in member comments for deeper
              questions. Moderators will be able to answer, pin official
              replies, hide unsafe comments, close sensitive policy discussions,
              and turn repeated questions into new FAQ entries.
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
