import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ImageIcon,
  Package,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { archiveMerchProduct, editMerchProduct } from "@/app/actions";
import { ContentReportForm } from "@/app/content-report-form";
import { MediaLightbox } from "@/app/media-lightbox";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProtectedVideo } from "@/app/protected-video";
import { SavedItemButton } from "@/app/saved-item-button";
import { ShareActions } from "@/app/share-actions";
import { platformFeePercentLabel } from "@/lib/payments/fees";
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
  shipping_required: boolean;
  ships_from_city: string | null;
  ships_from_region: string | null;
  status: string;
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

function priceInputValue(product: Pick<MerchProduct, "price_cents">) {
  return String(product.price_cents / 100);
}

const merchCategoryOptions = [
  ["apparel", "Apparel"],
  ["print", "Print"],
  ["art", "Art"],
  ["sticker", "Sticker"],
  ["accessory", "Accessory"],
  ["other", "Other"],
] as const;

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
      "id, title, description, category, status, price_cents, currency, inventory_quantity, inventory_reserved, shipping_required, ships_from_city, ships_from_region, is_official, merch_product_media(id, storage_bucket, storage_path, media_type, sort_order), profiles:profiles!merch_products_seller_id_fkey(id, username, display_name, account_type, license_verified_at)",
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("moderation_status", "active")
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

async function hasBlockRelationship({
  profileId,
  supabase,
  userId,
}: {
  profileId?: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId || !profileId || userId === profileId) return false;

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${profileId}),and(blocker_id.eq.${profileId},blocked_id.eq.${userId})`,
    )
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
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
  const { data: savedItem } = claims?.sub
    ? await supabase
        .from("saved_items")
        .select("subject_id")
        .eq("user_id", claims.sub)
        .eq("subject_type", "merch_product")
        .eq("subject_id", product.id)
        .maybeSingle<{ subject_id: string }>()
    : { data: null };
  const media = product.merch_product_media[0];
  const mediaSrc = media ? mediaUrl(media.storage_bucket, media.storage_path) : null;
  const available = product.inventory_quantity - product.inventory_reserved;
  const isOwnProduct = claims?.sub === product.profiles?.id;
  if (
    !product.is_official &&
    !isOwnProduct &&
    (await hasBlockRelationship({
      profileId: product.profiles?.id,
      supabase,
      userId: claims?.sub,
    }))
  ) {
    notFound();
  }

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
                {product.inventory_reserved > 0 && isOwnProduct ? (
                  <span className="block text-xs font-medium text-[var(--muted-strong)]">
                    {Intl.NumberFormat("en-US").format(product.inventory_reserved)} reserved in active checkout
                  </span>
                ) : null}
              </p>

              {isOwnProduct ? (
                <details className="mt-5 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
                    <Pencil className="size-4" />
                    Manage Merch
                  </summary>
                  <p className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,var(--card-rim))] bg-[color-mix(in_srgb,var(--brand-gold)_10%,var(--paper-warm))] p-3 text-xs leading-5 text-[var(--muted-strong)]">
                    Saving an active or approved product sends it back to admin
                    review before checkout opens again.
                  </p>
                  <form action={editMerchProduct} className="mt-4 space-y-3">
                    <input name="product_id" type="hidden" value={product.id} />
                    <input
                      name="return_path"
                      type="hidden"
                      value={`/merch/${product.id}`}
                    />
                    <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                      Title
                      <input
                        className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                        defaultValue={product.title}
                        maxLength={120}
                        name="title"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                      Category
                      <select
                        className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                        defaultValue={product.category}
                        name="category"
                      >
                        {merchCategoryOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                      Description
                      <textarea
                        className="mt-1 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 py-3 text-sm text-[var(--foreground)]"
                        defaultValue={product.description ?? ""}
                        maxLength={4000}
                        name="description"
                        placeholder="Add sizing, materials, shipping notes, or edition info."
                        rows={6}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                        Price
                        <input
                          className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                          defaultValue={priceInputValue(product)}
                          inputMode="decimal"
                          maxLength={20}
                          name="price"
                          required
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                        Inventory
                        <input
                          className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                          defaultValue={product.inventory_quantity}
                          min={product.inventory_reserved}
                          name="inventory_quantity"
                          required
                          type="number"
                        />
                        {product.inventory_reserved > 0 ? (
                          <span className="mt-1 block text-[11px] normal-case leading-4 text-[var(--muted-strong)]">
                            {Intl.NumberFormat("en-US").format(product.inventory_reserved)} unit(s)
                            are reserved in active checkout, so inventory cannot
                            be lowered below that amount.
                          </span>
                        ) : null}
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-xs font-bold uppercase text-[var(--muted-strong)]">
                        <input
                          className="size-4 accent-[var(--gold)]"
                          defaultChecked={product.shipping_required}
                          name="shipping_required"
                          type="checkbox"
                        />
                        Requires shipping address
                      </label>
                      <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                        Ships from city
                        <input
                          className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                          defaultValue={product.ships_from_city ?? ""}
                          maxLength={80}
                          name="ships_from_city"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
                        Ships from region
                        <input
                          className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                          defaultValue={product.ships_from_region ?? ""}
                          maxLength={80}
                          name="ships_from_region"
                        />
                      </label>
                    </div>
                    <button className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                      Save changes
                    </button>
                  </form>
                  <form action={archiveMerchProduct} className="mt-4">
                    <input name="product_id" type="hidden" value={product.id} />
                    <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[color-mix(in_srgb,#ef4444_38%,var(--card-rim))] px-4 text-sm font-semibold text-[var(--foreground)]">
                      <Trash2 className="size-4" />
                      Archive Merch
                    </button>
                  </form>
                </details>
              ) : null}
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
                  <input
                    name="return_to"
                    type="hidden"
                    value={`/merch/${product.id}`}
                  />
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
                    Checkout
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
                  href={`/login?return_to=${encodeURIComponent(`/merch/${product.id}`)}`}
                >
                  Sign in to buy
                </Link>
              )}
              <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
                Checkout includes a transparent {platformFeePercentLabel} TTC
                platform fee during launch. Orders are confirmed after payment
                status updates.
              </p>
            </section>

            {claims?.sub ? (
              <SavedItemButton
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-4 text-sm font-semibold"
                isSaved={Boolean(savedItem)}
                returnPath={`/merch/${product.id}`}
                subjectId={product.id}
                subjectType="merch_product"
              />
            ) : null}

            <ShareActions
              text={`Check this Merch on ${siteName}: ${product.title}`}
              title={product.title}
              url={`${siteUrl}/merch/${product.id}`}
            />

            {claims?.sub && !isOwnProduct ? (
              <section className="ttc-card rounded-md p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Safety
                </p>
                <ContentReportForm
                  returnPath={`/merch/${product.id}`}
                  subjectId={product.id}
                  subjectType="merch_product"
                />
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
