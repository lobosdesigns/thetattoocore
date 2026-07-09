import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  LinkIcon,
  LockKeyhole,
  MapPin,
  Send,
  Video,
} from "lucide-react";
import { acceptAdultTerms } from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { SavedItemButton } from "@/app/saved-item-button";
import { ShareActions } from "@/app/share-actions";
import { startConversation } from "@/app/messages/actions";
import { createClient } from "@/lib/supabase/server";
import { brandShareImage, siteName, siteUrl } from "@/lib/site";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type Profile = {
  account_type: string;
  display_name: string;
  id: string;
  license_verified_at: string | null;
  username: string;
};

type ViewerProfile = {
  adult_terms_accepted_at: string | null;
  is_adult_confirmed: boolean | null;
};

type GigMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type Gig = {
  category: string;
  city: string | null;
  compensation: string | null;
  contact_url: string | null;
  country: string | null;
  created_at: string;
  description: string | null;
  ends_at: string | null;
  gig_media: GigMedia[];
  id: string;
  is_sensitive: boolean;
  profiles: Profile | null;
  region: string | null;
  starts_at: string | null;
  title: string;
  visibility: "public_preview" | "members" | "private";
};

type GigPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string }>;
};

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function formatCategory(category: string) {
  return category.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatGigDate(gig: Pick<Gig, "ends_at" | "starts_at">) {
  if (!gig.starts_at) return "Flexible";

  const start = formatDate(gig.starts_at);
  if (!gig.ends_at) return start;

  return `${start} - ${formatDate(gig.ends_at)}`;
}

function locationText(gig: Pick<Gig, "city" | "country" | "region">) {
  return [gig.city, gig.region, gig.country].filter(Boolean).join(", ");
}

function isVerifiedProfile(profile?: Profile | null) {
  return isVerifiedProfessional(profile);
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#171412] px-2 py-1 text-xs font-semibold text-white">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function gigMessage(gig: Gig) {
  return `Hi, I am interested in your gig: ${gig.title}`;
}

function canViewSensitiveMedia({
  isSensitive,
  profile,
}: {
  isSensitive: boolean;
  profile?: ViewerProfile | null;
}) {
  if (!isSensitive) return true;

  return Boolean(profile?.is_adult_confirmed && profile.adult_terms_accepted_at);
}

function SensitiveMediaGate({
  isSignedIn,
  returnPath,
}: {
  isSignedIn: boolean;
  returnPath: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#171412]/35 p-4 backdrop-blur-sm">
      <div className="max-w-xs rounded-md border border-white/20 bg-[#171412]/92 p-4 text-center text-white shadow-2xl">
        <LockKeyhole className="mx-auto mb-2 size-6 text-[#c8953b]" />
        <p className="text-sm font-bold">You must sign in to see content</p>
        <p className="mt-1 text-xs leading-5 text-white/70">
          Sensitive body-art media requires login and 18+ confirmation.
        </p>
        {isSignedIn ? (
          <form action={acceptAdultTerms} className="mt-3">
            <input name="return_path" type="hidden" value={returnPath} />
            <button className="h-9 rounded-md bg-white px-3 text-sm font-semibold text-[#171412]">
              I am 18+
            </button>
          </form>
        ) : (
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-[#171412]"
            href="/login"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

async function getGig(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select(
      "id, title, description, category, city, region, country, starts_at, ends_at, compensation, contact_url, visibility, is_sensitive, created_at, gig_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!gigs_poster_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "gig_media",
    })
    .maybeSingle<Gig>();

  return data;
}

export async function generateMetadata({
  params,
}: GigPageProps): Promise<Metadata> {
  const { id } = await params;
  const gig = await getGig(id);

  if (!gig) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Gig not found",
    };
  }

  const publicIndexable = gig.visibility === "public_preview" && !gig.is_sensitive;
  const location = locationText(gig);
  const publicDescription =
    gig.description?.slice(0, 155) ||
    `${gig.title} on ${siteName}${location ? ` in ${location}` : ""}.`;
  const description = gig.is_sensitive
    ? `Sensitive body-art Gig on ${siteName}. Sign in to view eligible content.`
    : publicDescription;
  const image =
    publicIndexable && gig.gig_media[0]?.media_type === "image"
      ? mediaUrl(gig.gig_media[0].storage_bucket, gig.gig_media[0].storage_path)
      : brandShareImage;
  const shareTitle = gig.is_sensitive
    ? `Sensitive body-art content | ${siteName}`
    : gig.title;

  return {
    alternates: {
      canonical: `${siteUrl}/gigs/${gig.id}`,
    },
    description,
    openGraph: {
      description,
      images: [{ url: image }],
      title: shareTitle,
      type: "article",
      url: `${siteUrl}/gigs/${gig.id}`,
    },
    robots: {
      follow: publicIndexable,
      index: publicIndexable,
    },
    title: gig.is_sensitive ? "Sensitive Gig" : `${gig.title} | Gigs`,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title: shareTitle,
    },
  };
}

export default async function GigPage({ params, searchParams }: GigPageProps) {
  const { id } = await params;
  const message = (await searchParams)?.message;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const gig = await getGig(id);

  if (!gig) {
    notFound();
  }

  const { data: savedItem } =
    claims?.sub
      ? await supabase
          .from("saved_items")
          .select("subject_id")
          .eq("user_id", claims.sub)
          .eq("subject_type", "gig")
          .eq("subject_id", gig.id)
          .maybeSingle<{ subject_id: string }>()
      : { data: null };
  const { data: currentProfile } = claims?.sub
    ? await supabase
        .from("profiles")
        .select("adult_terms_accepted_at, is_adult_confirmed")
        .eq("id", claims.sub)
        .maybeSingle<ViewerProfile>()
    : { data: null };
  const isOwnGig = claims?.sub === gig.profiles?.id;
  const media = gig.gig_media[0];
  const showSensitiveMedia = canViewSensitiveMedia({
    isSensitive: gig.is_sensitive,
    profile: currentProfile,
  });

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-5xl bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to Gigs"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/#gigs"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Gigs</p>
                <p className="truncate text-xs capitalize text-[#766d62]">
                  {formatCategory(gig.category)}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {message ? (
          <div className="border-b border-[#cfc8bd] bg-[#e8e4dc] px-4 py-2 text-sm font-semibold">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="relative overflow-hidden rounded-md border border-[#3a332d] bg-[#171412] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
              {media ? (
                media.media_type === "video" ? (
                  <video
                    className={`aspect-[4/3] w-full bg-[#171412] object-contain ${
                      showSensitiveMedia ? "" : "scale-[1.02] blur-xl"
                    }`}
                    controls
                    playsInline
                    preload="metadata"
                    src={mediaUrl(media.storage_bucket, media.storage_path)}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className={`aspect-[4/3] w-full bg-[#171412] object-contain ${
                      showSensitiveMedia ? "" : "scale-[1.02] blur-xl"
                    }`}
                    src={mediaUrl(media.storage_bucket, media.storage_path)}
                  />
                )
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-white">
                  <BriefcaseBusiness className="size-12" />
                </div>
              )}
              {!showSensitiveMedia ? (
                <SensitiveMediaGate
                  isSignedIn={Boolean(claims?.sub)}
                  returnPath={`/gigs/${gig.id}`}
                />
              ) : null}
            </div>

            <section className="ttc-card mt-5 rounded-md border border-[#cfc8bd] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold">{gig.title}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#4f473f]">
                    <span className="rounded-md bg-[#efe7da] px-2 py-1 capitalize">
                      {formatCategory(gig.category)}
                    </span>
                    {gig.is_sensitive ? (
                      <span className="rounded-md bg-[#fff1c7] px-2 py-1 text-[#6f5200]">
                        Sensitive
                      </span>
                    ) : null}
                    {gig.visibility !== "public_preview" ? (
                      <span className="rounded-md bg-[#f7f4ef] px-2 py-1 capitalize">
                        {gig.visibility.replace("_", " ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                {gig.compensation ? (
                  <p className="rounded-md bg-[#171412] px-3 py-2 text-sm font-bold text-white">
                    {gig.compensation}
                  </p>
                ) : null}
              </div>

              {gig.description ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[#4f473f]">
                  {gig.description}
                </p>
              ) : (
                <p className="mt-5 text-sm leading-6 text-[#766d62]">
                  No details have been added yet.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#766d62]">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  {formatGigDate(gig)}
                </span>
                {locationText(gig) ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {locationText(gig)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  Posted {formatDate(gig.created_at)}
                </span>
                {media?.media_type === "video" ? (
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-4" />
                    Video gig
                  </span>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              <p className="text-xs font-semibold uppercase text-[#766d62]">
                Posted by
              </p>
              {gig.profiles ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[#171412] text-sm font-bold text-[#c8953b]">
                      {gig.profiles.display_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-bold">
                          {gig.profiles.display_name}
                        </p>
                        <VerifiedBadge profile={gig.profiles} />
                      </div>
                      <p className="text-xs text-[#766d62]">
                        @{gig.profiles.username}
                      </p>
                    </div>
                  </div>
                  <Link
                    className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                    href={`/u/${gig.profiles.username}`}
                  >
                    <LinkIcon className="size-4" />
                    View profile
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-[#766d62]">
                  Poster profile is unavailable.
                </p>
              )}
            </section>

            <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
              {gig.contact_url ? (
                <a
                  className="flex h-11 w-full items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                  href={gig.contact_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  View details
                </a>
              ) : claims?.sub && gig.profiles?.username && !isOwnGig ? (
                <form action={startConversation}>
                  <input name="username" type="hidden" value={gig.profiles.username} />
                  <input name="body" type="hidden" value={gigMessage(gig)} />
                  <input name="source_id" type="hidden" value={gig.id} />
                  <input name="source_title" type="hidden" value={gig.title} />
                  <input name="source_type" type="hidden" value="gig" />
                  <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                    <Send className="size-4" />
                    DM poster
                  </button>
                </form>
              ) : claims?.sub ? (
                <Link
                  className="flex h-11 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                  href="/messages"
                >
                  Open DMs
                </Link>
              ) : (
                <Link
                  className="flex h-11 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                  href="/login"
                >
                  Sign in to respond
                </Link>
              )}
              <p className="mt-3 text-xs leading-5 text-[#766d62]">
                Verify shop, convention, job, guest spot, and travel details
                directly with the poster before making plans.
              </p>
            </section>

            {claims?.sub ? (
              <SavedItemButton
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                isSaved={Boolean(savedItem)}
                returnPath={`/gigs/${gig.id}`}
                subjectId={gig.id}
                subjectType="gig"
              />
            ) : null}

            <ShareActions
              text={`Check this Gig on ${siteName}: ${gig.title}`}
              title={gig.title}
              url={`${siteUrl}/gigs/${gig.id}`}
            />

            {claims?.sub ? (
              <section className="ttc-card rounded-md border border-[#cfc8bd] bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-[#766d62]">
                  Safety
                </p>
                <ContentReportForm
                  returnPath={`/gigs/${gig.id}`}
                  subjectId={gig.id}
                  subjectType="gig"
                />
              </section>
            ) : null}

            {gig.is_sensitive ? (
              <section className="ttc-card rounded-md border border-[#cfc8bd] bg-[#fff7ec] p-4">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4" />
                  <div>
                    <p className="text-sm font-bold">18+ body-art context</p>
                    <p className="mt-1 text-xs leading-5 text-[#766d62]">
                      Sensitive gig media requires login and adult terms
                      acceptance where allowed.
                    </p>
                    {claims?.sub ? (
                      <form action={acceptAdultTerms} className="mt-3">
                        <input
                          name="return_path"
                          type="hidden"
                          value={`/gigs/${gig.id}`}
                        />
                        <button className="h-9 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white">
                          I am 18+
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
