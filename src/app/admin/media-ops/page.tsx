import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, Film, ImageIcon, ServerCog } from "lucide-react";
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
    "Next",
    "Store generated thumbnails and poster images so feeds, search, profiles, and share previews can load lighter media without exposing originals.",
  ],
  [
    "Scale trigger",
    "Move active reels to managed video processing when usage justifies adaptive playback and generated thumbnails.",
  ],
  [
    "Later",
    "Add a retryable processing queue for video transcodes, moderation thumbnails, failed media jobs, and post-upload safety review.",
  ],
] as const;
const mediaCostRules = [
  "Use the current delivery setup first for security and image-delivery polish before adding new paid media products.",
  "Keep original media on the current storage path while early traffic is small.",
  "Use client-side image compression first because it is free and reduces storage before upload.",
  "Keep current reel caps strict: 60 seconds and 50 MB for now.",
  "Do not enable paid video transcoding until reels are getting enough real usage to justify it.",
  "Consider managed image and video upgrades only after upload volume grows.",
] as const;
const mediaLimits = [
  ["Feed images", "Optimized in-browser before upload; keep the longest edge around 1600-2200px."],
  ["Reels", "MP4 and MOV clips stay capped at 60 seconds and 50 MB."],
  ["DM media", "Photos and GIF-style images only until private video handling is worth the cost."],
  ["Sensitive media", "No nudity for launch policy; legacy sensitive flags should stay protected where present."],
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
                Upload limits, image optimization, thumbnails, and future video pipeline.
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
            <p className="mt-1 text-xl font-bold">Raw capped reels</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <ServerCog className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Scale option</p>
            <p className="mt-1 text-xl font-bold">Upgrade later</p>
          </div>
        </div>

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
              Use this before paying for managed video. The current capped-video
              path should stay in place until the cost and moderation benefits
              are obvious.
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
              video transcoding is needed.
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
