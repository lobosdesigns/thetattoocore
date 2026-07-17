import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, Film, ImageIcon, Settings2 } from "lucide-react";
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
  "Use client-side image compression first because it is free and reduces storage before upload.",
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
  "Run Merch, ad, and booking-deposit test checkout flows only in test mode; confirm Admin > Payments reconciliation before any closeout decision.",
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
          <Link
            className="mt-4 inline-flex text-sm font-semibold underline"
            href="/help/getting-started"
          >
            Getting started guide
          </Link>
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
