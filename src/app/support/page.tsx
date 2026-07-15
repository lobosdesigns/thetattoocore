import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore support, safety reporting, privacy help, and account deletion request information.",
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
      "TheTattooCore is 18+ and does not allow visible nudity for launch. Pornography, sexual solicitation, sexualized minor content, scratcher promotion, scams, harassment, and unsafe equipment access are not allowed.",
    title: "Content Rules",
  },
  {
    body:
      "Signed-in members can request account deletion from Account > Data. During launch, deletion requests are reviewed manually so safety reports, marketplace issues, fraud concerns, and legal obligations can be handled correctly. The launch target is to review deletion requests within 30 days unless a safety, dispute, or legal hold requires more time.",
    title: "Account Deletion",
  },
  {
    body:
      "Merch checkout is limited during launch while seller approval, product safety review, shipping, fulfillment, refunds, tax, and payment review are finished. Public production purchases should stay limited until those rules are ready.",
    title: "Merch Support",
  },
  {
    body:
      "For login issues, verification questions, privacy requests, or urgent safety concerns, email support. Include your username and the link or screenshot that needs review when possible.",
    title: "Contact",
  },
  {
    body:
      "The Help Center is starting with FAQ and screenshot tutorial topics for bookings, ads, Merch setup, verification, Stuff, Gigs, Stories, DMs, and account settings. Email support with the feature name and where you got stuck if the guide you need is not live yet.",
    title: "How-To Library",
  },
] as const;

const quickActions = [
  {
    body: "Sign in and go straight to the Account data controls.",
    href: "/login?return_to=%2Faccount%23data-settings",
    label: "Request deletion",
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
            verification, and app-store support.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
