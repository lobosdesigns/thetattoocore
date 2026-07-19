import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore privacy overview for account data, public profiles, messages, location settings, and sponsored placements.",
  title: "Privacy",
};

const sections = [
  {
    body:
      "Account and profile data can include your email, username, display name, 18+ confirmation, account type, avatar, bio, website or social links, language preference, appearance preference, notification settings, and coarse location settings you choose to provide.",
    title: "Account And Profile Data",
  },
  {
    body:
      "Profiles, selected public posts, Stuff listings, Gigs, and public Merch items may be visible to other members and, where allowed, search engines. Account settings, private profile data, admin tools, draft content, and messages are not meant for public indexing.",
    title: "What Can Be Public",
  },
  {
    body:
      "Sensitive non-nude body-art content should not be exposed to logged-out visitors or social previews. Visible nudity is not allowed. When shared content is marked sensitive, public previews should use brand-safe text or logo imagery until the viewer signs in and accepts the 18+ body-art terms.",
    title: "Sensitive Previews",
  },
  {
    body:
      "Direct messages are for conversation participants. Admin and safety review access may be added only where needed to investigate abuse, legal risk, spam, or platform safety issues.",
    title: "Messages",
  },
  {
    body:
      "License, certification, and business documents for artists, studios, and vendors are private review materials. They should be visible only to the submitting account and authorized admins or moderators who need them for verification decisions.",
    title: "Verification Documents",
  },
  {
    body:
      "Merch, ads, and booking deposits can create checkout, order, receipt, fulfillment, refund, dispute, and support records. Checkout stays review-controlled, and payment questions are handled through private account or support review. TheTattooCore uses hosted checkout pages where available and does not collect raw payment or payout credentials in member forms.",
    title: "Commerce And Payments",
  },
  {
    body:
      "TheTattooCore stores coarse location settings such as city, region, and country code when you provide them. These settings can support marketplace discovery, gigs, events, and sponsored placements. Precise browser geolocation should be requested separately before use and should not be required for the basic social app.",
    title: "Location",
  },
  {
    body:
      "Language settings start as a manual account preference for page language signals and discovery context. Posts stay tied to their original text unless a translation view clearly labels translated text and keeps the original available.",
    title: "Language And Translation",
  },
  {
    body:
      "Sponsored placements use simple inputs such as country, region, city, language, style keywords, marketplace category, and placement. They should avoid hidden behavioral profiling, sensitive personal targeting, adult/minor targeting, AI ad expansion, and opaque lookalike-style automation. Sponsored placements should be clearly labeled and should explain the coarse reason they may be relevant.",
    title: "Ads",
  },
  {
    body:
      "TheTattooCore is not being built around AI art, AI search, AI feeds, or AI creator-replacement tools. Privacy-sensitive product decisions should favor clear member controls, manual review where needed, and understandable ranking or placement rules.",
    title: "No AI Platform Direction",
  },
  {
    body:
      "Members can update profile information from Settings, make profiles private, and request account deletion from Settings > Data and Help. Deletion requests are reviewed manually so safety reports, marketplace issues, fraud concerns, disputes, and legal obligations can be handled correctly. The review target is within 30 days unless a safety, dispute, or legal hold requires more time.",
    title: "Controls",
  },
  {
    body:
      "Some records may need to be kept for safety, fraud prevention, moderation audits, account deletion review, marketplace disputes, payment records, legal holds, or professional verification history. Public examples, help screenshots, and support images should avoid private DMs, verification documents, personal emails, real payment data, sensitive content, and copyrighted tattoo art.",
    title: "Retention And Review",
  },
];

export default function PrivacyPage() {
  return (
    <main className="ttc-page min-h-screen px-4 py-8">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label="TheTattooCore home">
            <LogoLockup />
          </Link>
          <Link
            className="ttc-surface rounded-md border px-4 py-2 text-sm font-semibold"
            href="/"
          >
            Back home
          </Link>
        </div>

        <div className="ttc-card ttc-page-panel rounded-lg border border-[var(--card-rim)] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[var(--muted-strong)]">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Privacy</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            This overview explains how TheTattooCore treats public discovery,
            account controls, messages, verification documents, commerce
            records, and support requests.
          </p>

          <div className="mt-7 space-y-5">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <p className="ttc-surface mt-7 rounded-md border p-4 text-sm leading-6 text-[var(--muted)]">
            Privacy requests can be sent to{" "}
            <a className="font-semibold underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            . Signed-in members can also{" "}
            <Link
              className="font-semibold underline"
              href="/login?return_to=%2Fsettings%2Fhelp"
            >
              request account deletion from Settings
            </Link>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
