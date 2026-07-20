import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Film, ImageIcon, Settings2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const mediaOpsStages = [
  [
    "Live now",
    "Browser image optimization, saved-size feedback, file checks, dimension checks, and 60-second MP4/MOV reel validation.",
  ],
  [
    "Preview prep",
    "Add generated thumbnails and poster images so feeds, search, profiles, and share previews can load lighter previews before full media opens.",
  ],
  [
    "Scale trigger",
    "Upgrade active reels when usage justifies smoother playback, automatic poster images, and faster browsing.",
  ],
  [
    "Review queue",
    "Add retry tools for poster generation, moderation thumbnails, failed media jobs, and post-upload safety review.",
  ],
] as const;
const mediaCostRules = [
  "Use the current delivery path first for safety and image polish before adding new paid media products.",
  "Keep original media on the current private path while early traffic is small.",
  "Use client-side image compression first because it keeps uploads lighter before posting.",
  "Keep current reel caps strict: 60 seconds and 50 MB for now.",
  "Do not enable paid video upgrades until reels are getting enough real usage to justify it.",
  "Consider managed image and video upgrades only after upload volume grows.",
] as const;
const mediaLimits = [
  ["4U images", "Optimized in-browser before upload; keep the longest edge around 1600-2200px."],
  ["Reels", "MP4 and MOV clips stay capped at 60 seconds and 50 MB."],
  ["DM media", "Photos and GIF-style images only until private video handling is worth the cost."],
  ["Sensitive media", "No-visible-nudity policy; legacy sensitive flags should stay protected where present."],
] as const;
const streamReadiness = [
  "Weekly reel uploads are high enough that current video delivery is slowing feeds or raising bandwidth cost.",
  "Moderation has enough volume that generated posters and review thumbnails save real admin time.",
  "Payment, app-store, and policy review are stable enough that paid video upgrades will not be wasted on rework.",
  "A fallback path exists for failed transcodes so member posts do not disappear silently.",
] as const;
const thumbnailContract = [
  "Store poster path, width, height, duration, and source media id next to the media row.",
  "Use posters in feeds, search, profile grids, and share cards before loading heavier video.",
  "Keep private or sensitive posters behind the same visibility checks as their source media.",
  "Record processing status so admins can retry failed thumbnails without re-uploading member media.",
] as const;
const betaQaLaunchChecks = [
  "Run login, signup, email confirmation, forgot-password, and reset-password inside the browser/PWA/native wrapper without leaving the app.",
  "Run the two-user DM pass: search a connected profile, send text, send a photo/GIF, open the notification, reply, and confirm read/delivered markers.",
  "Create 4U, Gossip, Story, Stuff, Gig, and Merch test content on mobile; confirm crop tools, media viewer, comments, edit/delete, reports, and Load more behavior.",
  "Submit artist, studio, and vendor verification with safe dummy documents; approve and reject from Admin > Verification.",
  "Run Merch, ad, and booking-deposit controlled checkout flows; confirm Admin > Payments reconciliation before any closeout decision.",
  "Prepare store screenshots from safe sample accounts only: no private DMs, license documents, nudity, real payment data, or personal owner contact details.",
] as const;
const storeSubmissionChecks = [
  "Confirm Terms, Privacy, Support, account deletion, 18+ signup, no-visible-nudity policy, and company support contact copy match the live build.",
  "Complete store data-safety/privacy answers from current app behavior only, including public profiles, DMs, notifications, verification documents, payments, and Merch orders.",
  "Capture screenshots from clean sample accounts with safe tattoo/media examples, visible Help access, and no private messages, license evidence, bank details, real addresses, or owner personal contact info.",
  "Run a native-wrapper auth pass so login, signup, email confirmation, reset links, Help, Support, Terms, Privacy, and checkout-return routes stay inside the app experience.",
  "Finish production payment policy review for Merch, ads, booking deposits, refunds, disputes, seller payouts, platform fees, taxes, and app-store payment rules before public sales.",
  "Archive the real-device QA evidence: mobile overflow pass, Story composer pass, DM two-user pass, verification submission pass, Merch checkout test pass, and admin queue review pass.",
] as const;
const betaEvidencePack = [
  ["Smoke results", "Save the latest lint, build, public-route smoke, mobile smoke, and payment guard results with the deployed version."],
  ["Native install proof", "Save Android internal-test and iOS TestFlight install screenshots showing release track, version, and build number for the exact build under review."],
  ["Real-device clips", "Capture mobile clips for signup, profile save, 4U/Gossip posting, Story creation, DMs, Search, notifications, comments, and Help."],
  ["Commerce proof", "Capture controlled Merch checkout, seller payout guidance, fulfillment, refund-review request, ad funding, ad credits, and booking deposit return flows."],
  ["Trust proof", "Capture report handling, block/delete controls, verification approval/rejection, Help question moderation, data request review, and no-visible-nudity policy copy."],
  ["Store handoff", "Keep app screenshots, support/legal links, age-rating notes, data-safety notes, and native auth/checkout return checks together before review upload."],
] as const;
const helpTutorialReadiness = [
  ["Screenshot coverage", "Use the Help launch checklist totals to see which priority guides still need safe sample-account screenshots."],
  ["Short clips", "Record short clips for signup, profile save, posting, Stories, DMs, Search, verification, Merch, booking deposits, ads, and support discovery."],
  ["Capture rules", "Do not capture private DMs, license documents, real payment data, addresses, visible nudity, owner personal contact details, or unsafe marketplace examples."],
  ["Publishing pass", "After each new tutorial asset is added, run docs, public-route, and 390px mobile smoke before widening beta."],
] as const;
type BetaReleaseTone = "blocked" | "ready" | "watch";
const betaReleaseStatus: {
  body: string;
  href: string;
  icon: LucideIcon;
  label: string;
  status: string;
  tone: BetaReleaseTone;
}[] = [
  {
    body: "Internal testing release 1 (1.0) is active for the current tester list. Next: install on a real device and run the beta tester checklist.",
    href: "/help/beta-app-testing",
    icon: CheckCircle2,
    label: "Google Play",
    status: "Active internal test",
    tone: "ready",
  },
  {
    body: "Build 1.0 (3) is attached to the TTC Internal Testers group and ready for real-device auth, posting, DM, and checkout-return smoke.",
    href: "/help/beta-app-testing",
    icon: CheckCircle2,
    label: "Apple TestFlight",
    status: "Internal testing",
    tone: "ready",
  },
  {
    body: "Keep real purchases gated until seller payouts, refunds, disputes, tax/shipping rules, hosted checkout returns, and app-store policy review pass.",
    href: "/help/seller-payouts-payment-safety",
    icon: ShieldCheck,
    label: "Payments",
    status: "Launch-controlled",
    tone: "blocked",
  },
] as const;
const betaNextActions = [
  "Install iOS build 1.0 (3) from TestFlight and Android release 1 (1.0) from internal testing on real devices.",
  "Run real-device auth checks: login, signup, email confirmation, reset password, and support/legal links stay inside the app.",
  "Run two-user DM, notifications, posting, Stories, comments, profile edit, verification upload, Merch browsing, booking request, and test checkout passes.",
  "Save safe screenshots or short clips for any failed flow before changing code so the fix can be retested against the exact issue.",
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Media Ops",
};

export default async function AdminMediaOpsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; display_name: string; role: UserRole }>();

  if (!profile || !viewRoles.includes(profile.role)) {
    redirect("/admin");
  }

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Media ops</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Upload limits, image optimization, thumbnails, and video readiness.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[var(--muted-strong)]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        <AdminSectionNav activeHref="/admin/media-ops" />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <ImageIcon className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Image route</p>
            <p className="mt-1 text-xl font-bold">Client optimized</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <Film className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Video route</p>
            <p className="mt-1 text-xl font-bold">Capped reels</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <Settings2 className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Scale option</p>
            <p className="mt-1 text-xl font-bold">Ready when needed</p>
          </div>
        </div>

        <section className="ttc-card mb-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_44%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper)_88%,var(--gold)_10%)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
                Beta release status
              </p>
              <h2 className="mt-1 text-xl font-bold">Where the apps stand now</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Use this as the short admin view before inviting more testers:
                active Android test, Apple build processing, and launch gates
                that still need real-device proof.
              </p>
            </div>
            <Link
              className="inline-flex rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm font-semibold"
              href="/help/beta-app-testing"
            >
              App tester guide
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {betaReleaseStatus.map((item) => {
              const Icon = item.icon;
              const badgeClass =
                item.tone === "ready"
                  ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                  : item.tone === "watch"
                    ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]"
                    : "border-[color-mix(in_srgb,var(--danger)_35%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper-warm))] text-[var(--danger)]";

              return (
                <article
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4"
                  key={item.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="mt-1 size-5 text-[var(--gold)]" />
                    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${badgeClass}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {item.body}
                  </p>
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold underline"
                    href={item.href}
                  >
                    Open guide
                  </Link>
                </article>
              );
            })}
          </div>
          <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-4">
            <h3 className="text-sm font-bold">Next beta actions</h3>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
              {betaNextActions.map((action) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2"
                  key={action}
                >
                  {action}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ttc-card mb-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-soft)_90%,var(--gold)_8%)] p-5">
          <h2 className="text-lg font-bold">Beta QA launch checklist</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Use this before TestFlight, Google Play internal testing, public
            screenshots, or inviting a wider tester group.
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {betaQaLaunchChecks.map((check) => (
              <li
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]"
                key={check}
              >
                {check}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex text-sm font-semibold underline"
              href="/help/getting-started"
            >
              Getting started guide
            </Link>
            <Link
              className="inline-flex text-sm font-semibold underline"
              href="/help/beta-tester-checklist"
            >
              Beta tester checklist
            </Link>
          </div>
        </section>

        <section className="ttc-card mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
                Store submission
              </p>
              <h2 className="mt-1 text-lg font-bold">App handoff checklist</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Use this after beta QA passes and before uploading a build for
                external review or public app-store release.
              </p>
            </div>
            <Link
              className="inline-flex rounded-md border border-[var(--card-rim)] px-3 py-2 text-sm font-semibold"
              href="/support"
            >
              Support page
            </Link>
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {storeSubmissionChecks.map((check) => (
              <li
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]"
                key={check}
              >
                {check}
              </li>
            ))}
          </ol>
        </section>

        <section className="ttc-card mb-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-soft)_90%,var(--gold)_8%)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
                Beta evidence pack
              </p>
              <h2 className="mt-1 text-lg font-bold">What to save before widening beta</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Keep proof in one place so app review, tester support, and launch
                decisions are based on checked flows instead of memory.
              </p>
            </div>
            <Link
              className="inline-flex rounded-md border border-[var(--card-rim)] px-3 py-2 text-sm font-semibold"
              href="/help/beta-tester-checklist"
            >
              Tester guide
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {betaEvidencePack.map(([label, body]) => (
              <article
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                key={label}
              >
                <p className="text-sm font-bold">{label}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ttc-card mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
                Help tutorial readiness
              </p>
              <h2 className="mt-1 text-lg font-bold">Capture gaps to close before beta</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Keep the Help Center useful enough that testers and early
                members can solve setup questions without waiting on support.
              </p>
            </div>
            <Link
              className="inline-flex rounded-md border border-[var(--card-rim)] px-3 py-2 text-sm font-semibold"
              href="/help"
            >
              Help checklist
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {helpTutorialReadiness.map(([label, body]) => (
              <article
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-3"
                key={label}
              >
                <p className="text-sm font-bold">{label}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex text-sm font-semibold underline"
              href="/help/beta-tester-checklist"
            >
              Tester checklist
            </Link>
            <Link
              className="inline-flex text-sm font-semibold underline"
              href="/help/posting-stories-dms"
            >
              Posting and Stories guide
            </Link>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <h2 className="text-lg font-bold">Pipeline stages</h2>
            <div className="mt-4 grid gap-3">
              {mediaOpsStages.map(([label, body]) => (
                <article
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                  key={label}
                >
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <h2 className="text-lg font-bold">Cost rules</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                {mediaCostRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <h2 className="text-lg font-bold">Launch limits</h2>
              <div className="mt-3 space-y-3">
                {mediaLimits.map(([label, body]) => (
                  <div
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                    key={label}
                  >
                    <p className="text-sm font-bold">{label}</p>
                    <p className="mt-1 text-sm leading-5 text-[var(--muted-strong)]">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <h2 className="text-lg font-bold">Video upgrade checklist</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Use this before paying for higher-volume video tools. The current
              capped-video path should stay in place until the cost and
              moderation benefits are obvious.
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
              {streamReadiness.map((item) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <h2 className="text-lg font-bold">Thumbnail contract</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              The first media-processing job should be lightweight poster and
              thumbnail generation, because it improves feed speed before full
              video upgrades are needed.
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
              {thumbnailContract.map((item) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
