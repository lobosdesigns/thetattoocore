import Link from "next/link";
import type { Metadata } from "next";
import { HelpCenterSearch } from "./help-center-search";
import { LogoLockup } from "../logo-mark";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore Help Center for account setup, verification, bookings, ads, Merch, Stuff, Gigs, Stories, DMs, and safety basics.",
  title: "Help Center",
};

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
