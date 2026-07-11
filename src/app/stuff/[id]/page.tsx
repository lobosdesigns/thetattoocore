import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  LinkIcon,
  LockKeyhole,
  MapPin,
  Send,
  ShoppingBag,
  Video,
} from "lucide-react";
import { acceptAdultTerms } from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProtectedVideo } from "@/app/protected-video";
import { SavedItemButton } from "@/app/saved-item-button";
import { SensitiveContentGate } from "@/app/sensitive-content-gate";
import { ShareActions } from "@/app/share-actions";
import { startConversation } from "@/app/messages/actions";
import { createClient } from "@/lib/supabase/server";
import {
  brandShareImage,
  brandShareImageAlt,
  shareImage,
  siteName,
  siteUrl,
} from "@/lib/site";
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
  account_type: string;
  adult_terms_accepted_at: string | null;
  is_adult_confirmed: boolean | null;
  license_verified_at: string | null;
};

type ListingMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type Listing = {
  category: string;
  city: string | null;
  created_at: string;
  currency: string;
  description: string | null;
  id: string;
  is_sensitive: boolean;
  marketplace_media: ListingMedia[];
  price_cents: number | null;
  profiles: Profile | null;
  region: string | null;
  title: string;
  visibility: "public_preview" | "members" | "private";
};

type StuffPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string }>;
};

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function formatPrice(listing: Pick<Listing, "currency" | "price_cents">) {
  if (listing.price_cents == null) return "Contact seller";

  return new Intl.NumberFormat("en-US", {
    currency: listing.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(listing.price_cents / 100);
}

function locationText(listing: Pick<Listing, "city" | "region">) {
  return [listing.city, listing.region].filter(Boolean).join(", ");
}

function isVerifiedProfile(profile?: Profile | null) {
  return isVerifiedProfessional(profile);
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!isVerifiedProfile(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function listingMessage(listing: Listing) {
  return `Hi, I am interested in your Stuff listing: ${listing.title}`;
}

function canViewSensitiveMedia({
  isSensitive,
  profile,
}: {
  isSensitive: boolean;
  profile?: Pick<ViewerProfile, "adult_terms_accepted_at" | "is_adult_confirmed"> | null;
}) {
  if (!isSensitive) return true;

  return Boolean(profile?.is_adult_confirmed && profile.adult_terms_accepted_at);
}

async function getListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_listings")
    .select(
      "id, title, description, price_cents, currency, category, city, region, visibility, is_sensitive, created_at, marketplace_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!marketplace_listings_seller_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("moderation_status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "marketplace_media",
    })
    .maybeSingle<Listing>();

  return data;
}

export async function generateMetadata({
  params,
}: StuffPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Stuff listing not found",
    };
  }

  const publicIndexable =
    listing.visibility === "public_preview" && !listing.is_sensitive;
  const location = locationText(listing);
  const publicDescription =
    listing.description?.slice(0, 155) ||
    `${listing.title} on ${siteName}${location ? ` in ${location}` : ""}.`;
  const description = listing.is_sensitive
    ? `Sensitive non-nude body-art Stuff listing on ${siteName}. Sign in to view eligible content.`
    : publicDescription;
  const image =
    publicIndexable && listing.marketplace_media[0]?.media_type === "image"
      ? mediaUrl(
          listing.marketplace_media[0].storage_bucket,
          listing.marketplace_media[0].storage_path,
        )
      : brandShareImage;
  const shareTitle = listing.is_sensitive
    ? `Sensitive non-nude body-art content | ${siteName}`
    : listing.title;

  return {
    alternates: {
      canonical: `${siteUrl}/stuff/${listing.id}`,
    },
    description,
    openGraph: {
      description,
      images: [
        shareImage(
          image,
          publicIndexable ? "TheTattooCore Stuff listing media" : brandShareImageAlt,
        ),
      ],
      title: shareTitle,
      type: "article",
      url: `${siteUrl}/stuff/${listing.id}`,
    },
    robots: {
      follow: publicIndexable,
      index: publicIndexable,
    },
    title: listing.is_sensitive ? "Sensitive Stuff listing" : `${listing.title} | Stuff`,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title: shareTitle,
    },
  };
}

export default async function StuffPage({ params, searchParams }: StuffPageProps) {
  const { id } = await params;
  const message = (await searchParams)?.message;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const { data: savedItem } =
    claims?.sub
      ? await supabase
          .from("saved_items")
          .select("subject_id")
          .eq("user_id", claims.sub)
          .eq("subject_type", "marketplace_listing")
          .eq("subject_id", listing.id)
          .maybeSingle<{ subject_id: string }>()
      : { data: null };
  const { data: currentProfile } = claims?.sub
    ? await supabase
        .from("profiles")
        .select("account_type, adult_terms_accepted_at, is_adult_confirmed, license_verified_at")
        .eq("id", claims.sub)
        .maybeSingle<ViewerProfile>()
    : { data: null };
  const canContactSeller = isVerifiedProfessional(currentProfile);
  const isOwnListing = claims?.sub === listing.profiles?.id;
  const media = listing.marketplace_media[0];
  const mediaSrc = media
    ? mediaUrl(media.storage_bucket, media.storage_path)
    : null;
  const showSensitiveMedia = canViewSensitiveMedia({
    isSensitive: listing.is_sensitive,
    profile: currentProfile,
  });

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to Stuff"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/#marketplace"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Stuff</p>
                <p className="truncate text-xs text-[var(--muted-strong)]">
                  {listing.category}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        {message ? (
          <div className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-4 py-2 text-sm font-semibold">
            {message}
          </div>
        ) : null}

        <section className="grid min-w-0 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--ink)] shadow-[0_12px_30px_rgba(23,20,18,0.22)]">
              {media ? (
                media.media_type === "video" ? (
                  showSensitiveMedia && mediaSrc ? (
                    <MediaLightbox mediaType="video" src={mediaSrc}>
                      <ProtectedVideo
                        className="aspect-[4/3] w-full bg-[var(--ink)] object-contain"
                        src={mediaSrc}
                      />
                    </MediaLightbox>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
                      <div className="text-center opacity-45 blur-[1px]">
                        <LockKeyhole className="mx-auto mb-3 size-12" />
                        <p className="text-sm font-bold uppercase tracking-[0.18em]">
                          Sensitive media
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  showSensitiveMedia && mediaSrc ? (
                    <MediaLightbox
                      alt={listing.title}
                      mediaType="image"
                      src={mediaSrc}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="aspect-[4/3] w-full bg-[var(--ink)] object-contain"
                        src={mediaSrc}
                      />
                    </MediaLightbox>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(200,149,59,0.24),transparent_16rem),#171412] text-white">
                      <div className="text-center opacity-45 blur-[1px]">
                        <LockKeyhole className="mx-auto mb-3 size-12" />
                        <p className="text-sm font-bold uppercase tracking-[0.18em]">
                          Sensitive media
                        </p>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-white">
                  <ShoppingBag className="size-12" />
                </div>
              )}
              {!showSensitiveMedia ? (
                <SensitiveContentGate
                  isSignedIn={Boolean(claims?.sub)}
                  returnPath={`/stuff/${listing.id}`}
                />
              ) : null}
            </div>

            <section className="ttc-card mt-5 rounded-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold">{listing.title}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
                    <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1 capitalize">
                      {listing.category}
                    </span>
                    {listing.is_sensitive ? (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_30%,var(--paper-warm))] px-2 py-1 text-[var(--foreground)]">
                        Sensitive
                      </span>
                    ) : null}
                    {listing.visibility !== "public_preview" ? (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_84%,transparent)] px-2 py-1 capitalize">
                        {listing.visibility.replace("_", " ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatPrice(listing)}</p>
              </div>

              {listing.description ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {listing.description}
                </p>
              ) : (
                <p className="mt-5 text-sm leading-6 text-[var(--muted-strong)]">
                  No description has been added yet.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--muted-strong)]">
                {locationText(listing) ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {locationText(listing)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  Posted {formatDate(listing.created_at)}
                </span>
                {media?.media_type === "video" ? (
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-4" />
                    Video listing
                  </span>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="ttc-card rounded-md p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                Seller
              </p>
              {listing.profiles ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-sm font-bold text-[var(--brand-gold)]">
                      {listing.profiles.display_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-bold">
                          {listing.profiles.display_name}
                        </p>
                        <VerifiedBadge profile={listing.profiles} />
                      </div>
                      <p className="text-xs text-[var(--muted-strong)]">
                        @{listing.profiles.username}
                      </p>
                    </div>
                  </div>
                  <Link
                    className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                    href={`/u/${listing.profiles.username}`}
                  >
                    <LinkIcon className="size-4" />
                    View profile
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Seller profile is unavailable.
                </p>
              )}
            </section>

            <section className="ttc-card rounded-md p-4">
              {claims?.sub &&
              canContactSeller &&
              listing.profiles?.username &&
              !isOwnListing ? (
                <form action={startConversation}>
                  <input
                    name="username"
                    type="hidden"
                    value={listing.profiles.username}
                  />
                  <input
                    name="body"
                    type="hidden"
                    value={listingMessage(listing)}
                  />
                  <input name="source_id" type="hidden" value={listing.id} />
                  <input
                    name="source_title"
                    type="hidden"
                    value={listing.title}
                  />
                  <input
                    name="source_type"
                    type="hidden"
                    value="marketplace_listing"
                  />
                  <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                    <Send className="size-4" />
                    DM seller
                  </button>
                </form>
              ) : claims?.sub && isOwnListing ? (
                <Link
                  className="flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                  href="/messages"
                >
                  Open DMs
                </Link>
              ) : claims?.sub ? (
                <Link
                  className="flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                  href="/account#verification-settings"
                >
                  Verify to contact seller
                </Link>
              ) : (
                <Link
                  className="flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                  href="/login"
                >
                  Sign in to message
                </Link>
              )}
              <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
                Fans can browse Stuff. Buying, selling, trading, seller contact,
                and professional equipment activity, including tattoo machines,
                needles, pigments, tubes, and shop gear, require verified artist,
                studio, or approved vendor status.
              </p>
            </section>

            {claims?.sub ? (
              <SavedItemButton
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                isSaved={Boolean(savedItem)}
                returnPath={`/stuff/${listing.id}`}
                subjectId={listing.id}
                subjectType="marketplace_listing"
              />
            ) : null}

            <ShareActions
              text={`Check this Stuff listing on ${siteName}: ${listing.title}`}
              title={listing.title}
              url={`${siteUrl}/stuff/${listing.id}`}
            />

            {claims?.sub ? (
              <section className="ttc-card rounded-md p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Safety
                </p>
                <ContentReportForm
                  returnPath={`/stuff/${listing.id}`}
                  subjectId={listing.id}
                  subjectType="marketplace_listing"
                />
              </section>
            ) : null}

            {listing.is_sensitive ? (
              <section className="ttc-card rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,var(--card-rim))] bg-[color-mix(in_srgb,var(--brand-gold)_10%,var(--paper-warm))] p-4">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4" />
                  <div>
                    <p className="text-sm font-bold">18+ sensitive body-art context</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                      Sensitive non-nude listing media requires login and adult
                      terms acceptance where allowed.
                    </p>
                    {claims?.sub ? (
                      <form action={acceptAdultTerms} className="mt-3">
                        <input
                          name="return_path"
                          type="hidden"
                          value={`/stuff/${listing.id}`}
                        />
                        <button className="h-9 rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]">
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
