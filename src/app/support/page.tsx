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
    canonical: `${siteUrl}/support`,
  },
  description:
    "TheTattooCore support, safety reporting, privacy help, and account deletion request information.",
  keywords: metadataKeywords(
    siteKeywords,
    seoKeywordGroups.help,
    "tattoo app support",
    "tattoo safety reports",
    "account deletion help",
  ),
  title: "Support",
};

const sections = [
  {
    body:
      "Use the in-app Report button on posts, profiles, Stuff, Gigs, Merch, and Gossip whenever possible. Reports go to the moderation queue with the content attached.",
    title: "Safety And Reports",
  },
  {
    body:
      "TheTattooCore is 18+ and does not allow visible nudity. Pornography, sexual solicitation, sexualized minor content, scratcher promotion, scams, harassment, and unsafe equipment access are not allowed.",
    title: "Content Rules",
  },
  {
    body:
      "Merch checkout stays review-controlled. For missing, damaged, wrong, delayed, returned, fulfillment, refund, seller, or product-safety questions, use Support with the product or order link so the issue can be reviewed privately.",
    title: "Merch Support",
  },
  {
    body:
      "For login issues, verification questions, privacy requests, or urgent safety concerns, email support. Include your username and the link or screenshot that needs review when possible.",
    title: "Contact",
  },
  {
    body:
      "The Help Center has FAQ and tutorial topics for getting started, beta app testing, bookings, ads, Merch setup, verification, Stuff, Gigs, Stories, DMs, search, saved items, and Settings. Email support with the feature name and where you got stuck when a private account issue needs review.",
    title: "How-To Library",
  },
] as const;

const quickActions = [
  {
    body:
      "Delete your account and associated data, including when you cannot sign in.",
    href: "#account-deletion",
    label: "Delete account and data",
  },
  {
    body: "Read FAQ and tutorial topics for bookings, ads, Merch, verification, and member safety.",
    href: "/help",
    label: "Help Center",
  },
  {
    body: "Use this for login trouble, privacy help, urgent safety, or verification questions.",
    href: `mailto:${supportEmail}`,
    label: "Email support",
  },
  {
    body: "Sign in before reporting content when possible so the moderation queue has account context.",
    href: "/login",
    label: "Sign in",
  },
] as const;

const deletionEmailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
  `${siteName} account deletion request`,
)}`;

const guideLinks = [
  {
    body: "Priority setup guides for profile, verification, posting, bookings, Merch, payouts, ads, and safety.",
    href: "/help",
    label: "Launch setup checklist",
  },
  {
    body: "First-run setup, account types, privacy basics, main sections, verification, and Support.",
    href: "/help/getting-started",
    label: "Getting started",
  },
  {
    body: "Real-device beta checks for signup, mobile layout, posting, DMs, verification, bookings, seller tools, and admin go/no-go.",
    href: "/help/beta-tester-checklist",
    label: "Beta tester checklist",
  },
  {
    body: "Beta app install, login, in-app navigation, media upload, notifications, checkout return, and safe bug-report checks.",
    href: "/help/beta-app-testing",
    label: "Beta app testing",
  },
  {
    body: "Appointment types, slots, deposits, fees, and calendar files.",
    href: "/help/booking-appointments",
    label: "Booking guide",
  },
  {
    body: "Usernames, private results, saved searches, and search wording.",
    href: "/help/search-saved-people",
    label: "Search and Saved",
  },
  {
    body: "Reports, blocks, deletion requests, and private support issues.",
    href: "/help/privacy-safety-support",
    label: "Privacy and safety",
  },
  {
    body: "CSAE standards, minor safety reports, escalation, and safety contact details.",
    href: "/child-safety-standards",
    label: "Child safety standards",
  },
  {
    body: "4U, Gossip, Stuff, Gigs, Stories, DMs, comments, reports, blocks, and safe media rules.",
    href: "/help/posting-stories-dms",
    label: "Posting and Stories",
  },
  {
    body: "Artist, studio, and vendor document review basics.",
    href: "/help/verification-documents",
    label: "Verification guide",
  },
  {
    body: "Product review, seller readiness, fulfillment, tracking, package issues, and refunds.",
    href: "/help/merch-products-orders",
    label: "Merch guide",
  },
  {
    body: "Missing packages, wrong items, refund review, disputes, seller non-delivery, and private evidence handling.",
    href: "/help/order-refunds-disputes",
    label: "Order support",
  },
  {
    body: "Seller payout setup, checkout readiness, fees, refunds, disputes, and payment safety.",
    href: "/help/seller-payouts-payment-safety",
    label: "Seller payouts",
  },
] as const;

export default function SupportPage() {
  return (
    <main className="ttc-page min-h-screen px-4 py-8">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${siteName} home`}>
            <LogoLockup />
          </Link>
          <Link
            className="ttc-surface rounded-md border px-4 py-2 text-sm font-semibold"
            href="/login"
          >
            Sign in
          </Link>
        </div>

        <div className="ttc-card ttc-page-panel rounded-lg border border-[var(--card-rim)] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[var(--muted-strong)]">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Support</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Help for account access, safety reports, privacy requests,
            verification, commerce questions, and app support.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                className="ttc-surface rounded-md border p-3 text-sm font-semibold hover:border-[var(--gold)]"
                href={action.href}
                key={action.label}
              >
                <span className="block">{action.label}</span>
                <span className="mt-2 block text-xs font-medium leading-5 text-[var(--muted)]">
                  {action.body}
                </span>
              </Link>
            ))}
          </div>

          <section
            aria-labelledby="account-deletion-heading"
            className="mt-7 scroll-mt-6 border-y border-[var(--card-rim)] py-5"
            id="account-deletion"
          >
            <h2 className="text-lg font-bold" id="account-deletion-heading">
              Delete your account and associated data
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Signed-in members can initiate deletion from Settings &gt; Data
              and Help. This requests deletion of the entire {siteName} account
              and associated personal data, including profile information and
              user-generated posts, comments, messages, and uploaded media,
              subject to the limited retention needs below.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              If you cannot sign in or no longer have the app, email support
              from the address tied to the account when possible. Include your
              username and clearly state that you want the entire account and
              associated data deleted. Support will verify account ownership
              before processing the request.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              We may retain only records needed for safety investigations,
              fraud prevention, unresolved orders or payment disputes,
              moderation audits, or legal obligations. Retained records are
              restricted and are not used to keep a public profile active. The
              review target is within 30 days unless a safety, dispute, or legal
              hold requires more time, and support confirms when processing is
              complete.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                className="ttc-surface inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                href="/login?return_to=%2Fsettings%2Fhelp"
              >
                Open deletion controls
              </Link>
              <a
                className="ttc-surface inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                href={deletionEmailHref}
              >
                Email deletion request
              </a>
            </div>
          </section>

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

          <section className="ttc-surface mt-7 rounded-md border p-4">
            <h2 className="text-lg font-bold">Popular Help Guides</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {guideLinks.map((guide) => (
                <Link
                  className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3 text-sm font-semibold hover:border-[var(--gold)]"
                  href={guide.href}
                  key={guide.href}
                >
                  <span className="block">{guide.label}</span>
                  <span className="mt-2 block text-xs font-medium leading-5 text-[var(--muted)]">
                    {guide.body}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <div className="ttc-surface mt-7 rounded-md border p-4 text-sm leading-6 text-[var(--muted)]">
            <p className="font-semibold">Support email</p>
            <a className="mt-1 block underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm font-semibold sm:flex-row">
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
