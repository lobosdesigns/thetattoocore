import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ImageIcon, Package, ShieldCheck } from "lucide-react";
import { MediaLightbox } from "@/app/media-lightbox";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProtectedVideo } from "@/app/protected-video";
import { ShareActions } from "@/app/share-actions";
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

type MerchMedia = {
  id: string;
  media_type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
};

type MerchProduct = {
  category: string;
  currency: string;
  description: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  is_official: boolean;
  merch_product_media: MerchMedia[];
  price_cents: number;
  profiles: Profile | null;
  title: string;
};

type MerchPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string }>;
};

function mediaUrl(bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}

function VerifiedBadge({ profile }: { profile?: Profile | null }) {
  if (!isVerifiedProfessional(profile)) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-xs font-semibold text-[var(--background)]">
      <BadgeCheck className="size-3" />
      Verified
    </span>
  );
}

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merch_products")
    .select(
      "id, title, description, category, price_cents, currency, inventory_quantity, inventory_reserved, is_official, merch_product_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!merch_products_seller_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("status", "active")
    .order("sort_order", {
      ascending: true,
      referencedTable: "merch_product_media",
    })
    .maybeSingle<MerchProduct>();

  if (!data) return null;

  if (!data.is_official && !isVerifiedProfessional(data.profiles)) {
    return null;
  }

  return data;
}

export async function generateMetadata({
  params,
}: MerchPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Merch not found",
    };
  }

  const media = product.merch_product_media[0];
  const image =
    media?.media_type === "image"
      ? mediaUrl(media.storage_bucket, media.storage_path)
      : brandShareImage;
  const description =
    product.description?.slice(0, 155) ||
    `${product.title} merch on ${siteName}.`;

  return {
    alternates: {
      canonical: `${siteUrl}/merch/${product.id}`,
    },
    description,
    openGraph: {
      description,
      images: [
        shareImage(
          image,
          media?.media_type === "image" ? "TheTattooCore merch media" : brandShareImageAlt,
        ),
      ],
      title: product.title,
      type: "article",
      url: `${siteUrl}/merch/${product.id}`,
    },
    title: `${product.title} | Merch`,
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title: product.title,
    },
  };
}

export default async function MerchProductPage({
  params,
  searchParams,
}: MerchPageProps) {
  const { id } = await params;
  const message = (await searchParams)?.message;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const media = product.merch_product_media[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const available = product.inventory_quantity - product.inventory_reserved;
  const isOwnProduct = claims?.sub === product.profiles?.id;

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to Merch"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/#merch"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Merch</p>
                <p className="truncate text-xs capitalize text-[var(--muted-strong)]">
                  {formatCategory(product.category)}
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
              {media && mediaSrc ? (
                media.media_type === "video" ? (
                  <MediaLightbox mediaType="video" src={mediaSrc}>
                    <ProtectedVideo
                      className="aspect-[4/3] w-full bg-[var(--ink)] object-contain"
                      src={mediaSrc}
                    />
                  </MediaLightbox>
                ) : (
                  <MediaLightbox alt={product.title} mediaType="image" src={mediaSrc}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="aspect-[4/3] w-full bg-[var(--ink)] object-contain"
                      src={mediaSrc}
                    />
                  </MediaLightbox>
                )
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-white">
                  <ImageIcon className="size-12" />
                </div>
              )}
            </div>

            <section className="ttc-card mt-5 rounded-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold">{product.title}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
                    <span className="rounded-md bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] px-2 py-1 capitalize">
                      {formatCategory(product.category)}
                    </span>
                    {product.is_official ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-2 py-1 text-[var(--background)]">
                        <ShieldCheck className="size-3" />
                        Official TTC
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="text-2xl font-bold">
                  {money(product.price_cents, product.currency)}
                </p>
              </div>

              {product.description ? (
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {product.description}
                </p>
              ) : (
                <p className="mt-5 text-sm leading-6 text-[var(--muted-strong)]">
                  No description has been added yet.
                </p>
              )}

              <p className="mt-5 text-sm font-semibold text-[var(--muted)]">
                {available > 0
                  ? `${Intl.NumberFormat("en-US").format(available)} available`
                  : "Sold out"}
              </p>
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="ttc-card rounded-md p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                Seller
              </p>
              {product.profiles ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-sm font-bold text-[var(--brand-gold)]">
                      {product.profiles.display_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-bold">
                          {product.profiles.display_name}
                        </p>
                        <VerifiedBadge profile={product.profiles} />
                      </div>
                      <p className="text-xs text-[var(--muted-strong)]">
                        @{product.profiles.username}
                      </p>
                    </div>
                  </div>
                  <Link
                    className="mt-4 flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                    href={`/u/${product.profiles.username}`}
                  >
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
              {claims?.sub && available > 0 && !isOwnProduct ? (
                <form action="/api/merch/checkout" method="post">
                  <input name="product_id" type="hidden" value={product.id} />
                  <label className="block">
                    <span className="text-sm font-medium">Quantity</span>
                    <input
                      className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                      defaultValue="1"
                      max={Math.min(available, 10)}
                      min="1"
                      name="quantity"
                      type="number"
                    />
                  </label>
                  <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                    <Package className="size-4" />
                    Checkout with Stripe
                  </button>
                </form>
              ) : claims?.sub && isOwnProduct ? (
                <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm text-[var(--muted)]">
                  This is your merch product.
                </p>
              ) : claims?.sub ? (
                <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm text-[var(--muted)]">
                  This merch product is sold out.
                </p>
              ) : (
                <Link
                  className="flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                  href="/login"
                >
                  Sign in to buy
                </Link>
              )}
              <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
                Checkout uses Stripe and includes a transparent 2% TTC platform
                fee in test mode. Orders are confirmed after Stripe sends the
                payment webhook back to TheTattooCore.
              </p>
            </section>

            <ShareActions
              text={`Check this Merch on ${siteName}: ${product.title}`}
              title={product.title}
              url={`${siteUrl}/merch/${product.id}`}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}
