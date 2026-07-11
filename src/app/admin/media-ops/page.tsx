import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, Film, ImageIcon, ServerCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const mediaOpsStages = [
  [
    "Live now",
    "Browser WebP image optimization, saved-size feedback, server signature checks, dimension checks, and 60-second MP4/MOV/WebM reel validation.",
  ],
  [
    "Next",
    "Store generated thumbnails and poster images so feeds, search, profiles, and share previews can load lighter media without exposing originals.",
  ],
  [
    "Scale trigger",
    "Move active reels to Cloudflare Stream when video usage justifies paid transcoding, adaptive playback, and managed thumbnails.",
  ],
  [
    "Later",
    "Add a retryable processing queue for video transcodes, moderation thumbnails, failed media jobs, and post-upload safety review.",
  ],
] as const;
const mediaCostRules = [
  "Keep original media in Supabase Storage while early traffic is small.",
  "Use client-side image compression first because it is free and reduces storage before upload.",
  "Keep current reel caps strict: 60 seconds and 50 MB while videos are uploaded raw.",
  "Do not enable paid video transcoding until reels are getting enough real usage to justify it.",
  "Consider Cloudflare Images for image variants and Cloudflare Stream for video only after upload volume grows.",
] as const;
const mediaLimits = [
  ["Feed images", "Optimized in-browser before upload; keep the longest edge around 1600-2200px."],
  ["Reels", "MP4, MOV, and WebM clips stay capped at 60 seconds and 50 MB."],
  ["DM media", "Photos and GIF-style images only until private video handling is worth the cost."],
  ["Sensitive media", "No nudity for launch policy; legacy sensitive flags should stay protected where present."],
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
        <header className="mb-6 flex flex-col gap-4 border-b border-[#cfc8bd] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#766d62]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Media ops</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                Upload limits, image optimization, thumbnails, and future video pipeline.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[#766d62]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <ImageIcon className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Image route</p>
            <p className="mt-1 text-xl font-bold">Client optimized</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <Film className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Video route</p>
            <p className="mt-1 text-xl font-bold">Raw capped reels</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <ServerCog className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Scale option</p>
            <p className="mt-1 text-xl font-bold">Cloudflare Stream</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
            <h2 className="text-lg font-bold">Pipeline stages</h2>
            <div className="mt-4 grid gap-3">
              {mediaOpsStages.map(([label, body]) => (
                <article
                  className="rounded-md border border-[#e5ded4] bg-white p-3"
                  key={label}
                >
                  <p className="text-xs font-bold uppercase text-[#766d62]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#4f473f]">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
              <h2 className="text-lg font-bold">Cost rules</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4f473f]">
                {mediaCostRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
            <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
              <h2 className="text-lg font-bold">Launch limits</h2>
              <div className="mt-3 space-y-3">
                {mediaLimits.map(([label, body]) => (
                  <div
                    className="rounded-md border border-[#e5ded4] bg-white p-3"
                    key={label}
                  >
                    <p className="text-sm font-bold">{label}</p>
                    <p className="mt-1 text-sm leading-5 text-[#766d62]">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
