import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  requestAccountDeletion,
  submitAdCampaign,
  submitLicenseVerification,
} from "./actions";
import { LicenseDocumentInput } from "./license-document-input";
import { ProfileForm } from "./profile-form";
import { PendingSubmitButton } from "../pending-submit-button";
import { countryOptions, languageOptions } from "@/lib/localization";
import { createClient } from "@/lib/supabase/server";
import { verificationEligibleAccountTypes } from "@/lib/verification";

type Claims = {
  sub: string;
  email?: string;
};

const adminRoles = ["moderator", "admin", "owner"];
const accountNavItems = [
  ["#profile-settings", "Profile"],
  ["#appearance-settings", "Appearance"],
  ["#language-settings", "Language"],
  ["#privacy-settings", "Privacy"],
  ["#notification-settings", "Notifications"],
  ["#verification-settings", "Verify"],
  ["#advertising-settings", "Ads"],
  ["#order-settings", "Orders"],
  ["#data-settings", "Data"],
] as const;

function AccountSetupGuide({
  isFirstProfile,
}: {
  isFirstProfile: boolean;
}) {
  const steps = [
    ["1", "Save profile", "Choose a username, account type, country, language, and confirm 18+."],
    ["2", "Start posting", "Use the bottom-right plus button from 4U, Gossip, Stuff, Gigs, or planned Merch."],
    ["3", "Verify later", "Artists, studios, and vendors can upload license or business documents for admin review."],
  ] as const;

  return (
    <section className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_28%,var(--card-rim))] bg-[var(--ink)] p-5 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            {isFirstProfile ? "First setup" : "Account path"}
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {isFirstProfile
              ? "Set up your core profile"
              : "Keep your account ready to post"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            {isFirstProfile
              ? "This one save unlocks posting, comments, DMs, follows, and community features. Stuff transactions need verification."
              : "Your saved profile powers posting, public discovery, DMs, local results, and verification."}
          </p>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold text-[var(--foreground)]"
          href="/"
        >
          Open app
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map(([number, title, body]) => (
          <div
            className="rounded-md border border-white/15 bg-[color-mix(in_srgb,var(--paper-warm)_8%,transparent)] p-3"
            key={number}
          >
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-sm font-bold text-[var(--foreground)]">
              {number}
            </span>
            <h2 className="mt-3 text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Account",
};

function adLabel(value: string) {
  if (value === "4u") return "4U";

  return value.replaceAll("_", " ");
}

const verificationStandards = [
  "Artists and studios must show current licensing, certification, or local legal proof before professional access is approved.",
  "Vendors must show proper business licensing before vendor access, seller contact, or Stuff trading is approved.",
  "Stuff stays browseable for fans, but buy, sell, trade, and seller-contact actions are reserved for verified artists, studios, and vendors.",
  "Expired documents, scratcher activity, unlicensed studios, AI tattoo art claims, and unsafe equipment access are rejected.",
] as const;

const advertisingStandards = [
  "Artist growth campaigns can appear in 4U and Gossip for leads, messages, and engagement.",
  "Stuff campaigns stay in Stuff and focus on listing views, eligible seller messages, and marketplace engagement.",
  "Targeting stays simple: coarse location, language, style keywords, category, and chosen placement.",
] as const;

const advertisingReviewRules = [
  "No AI-generated tattoo art or misleading AI creator replacement claims.",
  "No scratcher promotion, unlicensed studio promotion, or unsafe equipment sales.",
  "No sensitive personal targeting, adult/minor targeting, or hidden behavioral profiling.",
] as const;

function dollars(cents: number) {
  return Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function adClickRate({
  clicks,
  impressions,
}: {
  clicks: number;
  impressions: number;
}) {
  if (!impressions) return "0.0%";

  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function verificationStatusClass(status: "pending" | "approved" | "rejected") {
  if (status === "approved") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  if (status === "rejected") return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";

  return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
}

function orderStatusClass(status: string) {
  if (status === "paid" || status === "fulfilled") {
    return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  }

  if (status === "pending_checkout") {
    return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  }

  if (status === "cancelled" || status === "payment_failed") {
    return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  }

  return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not provided";
}

function isExpiredDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function AccountReadinessPanel({
  canSubmitLicense,
  canUploadVerification,
  hasPendingVerification,
  isLicenseVerified,
  profile,
}: {
  canSubmitLicense: string | false | undefined;
  canUploadVerification: boolean;
  hasPendingVerification: boolean;
  isLicenseVerified: boolean;
  profile:
    | {
        banned_at?: string | null;
        is_adult_confirmed?: boolean | null;
        license_verified_at?: string | null;
        suspended_at?: string | null;
        username?: string | null;
      }
    | null;
}) {
  const items = [
    {
      body: profile?.username
        ? `@${profile.username} is saved.`
        : "Choose and save a username first.",
      label: "Profile",
      ready: Boolean(profile?.username),
    },
    {
      body: profile?.is_adult_confirmed
        ? "18+ confirmation is saved."
        : "Confirm 18+ terms before viewing sensitive non-nude body-art content.",
      label: "18+",
      ready: Boolean(profile?.is_adult_confirmed),
    },
    {
      body: isLicenseVerified
        ? "Stuff seller contact and professional gear access are active."
        : hasPendingVerification
          ? "Verification is waiting for admin review."
          : canSubmitLicense
            ? "Upload current license or business proof."
            : "Switch account type to artist, studio, or vendor to apply.",
      label: "Verification",
      ready: isLicenseVerified,
    },
    {
      body: profile?.banned_at
        ? "Account is banned."
        : profile?.suspended_at
          ? "Account is suspended."
          : "Account is in good standing.",
      label: "Standing",
      ready: !profile?.banned_at && !profile?.suspended_at,
    },
  ];

  return (
    <section className="ttc-card mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Account readiness
          </p>
          <h2 className="text-lg font-bold">What is unlocked right now</h2>
        </div>
        {canUploadVerification ? (
          <a
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-white"
            href="#verification-settings"
          >
            Upload proof
          </a>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="ttc-surface rounded-md border px-3 py-2"
            key={item.label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  item.ready
                    ? "bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                    : "bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]"
                }`}
              >
                {item.ready ? "Ready" : "Needs work"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "username, display_name, avatar_url, account_type, bio, city, region, country_code, preferred_language, theme_preference, location_personalization_enabled, is_adult_confirmed, is_private, adult_terms_accepted_at, website_url, instagram_url, license_verified_at, suspended_at, banned_at, role, notify_follow_activity, notify_message_activity, notify_feed_activity, notify_thread_activity, notify_marketplace_gig_activity, notification_quiet_hours_enabled, notification_quiet_hours_start, notification_quiet_hours_end, notification_timezone, notify_email_important, notify_push_enabled",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  const { data: verificationRequests } = await supabase
    .from("license_verification_requests")
    .select(
      "id, license_name, issuing_region, expires_on, status, reviewer_note, created_at, reviewed_at",
    )
    .eq("profile_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<
      {
        created_at: string;
        expires_on: string | null;
        id: string;
        issuing_region: string;
        license_name: string;
        reviewed_at: string | null;
        reviewer_note: string | null;
        status: "pending" | "approved" | "rejected";
      }[]
    >();
  const { data: adCampaigns } = await supabase
    .from("ad_campaigns")
    .select(
      "id, name, title, campaign_type, goal, status, bid_cents, daily_budget_cents, created_at, ad_campaign_placements(placement), ad_events(event_type)",
    )
    .eq("advertiser_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<
      {
        ad_events: { event_type: "impression" | "click" | "message_lead" }[];
        ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" }[];
        bid_cents: number;
        campaign_type: string;
        created_at: string;
        daily_budget_cents: number;
        goal: string;
        id: string;
        name: string;
        status: string;
        title: string;
      }[]
    >();
  const { data: deletionRequests } = await supabase
    .from("account_deletion_requests")
    .select("id, status, requested_at, reviewer_note")
    .eq("profile_id", claims.sub)
    .order("requested_at", { ascending: false })
    .limit(3)
    .returns<
      {
        id: string;
        requested_at: string;
        reviewer_note: string | null;
        status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
      }[]
    >();
  const { data: merchOrders } = await supabase
    .from("merch_orders")
    .select(
      "id, status, currency, total_cents, customer_email, shipping_name, created_at, fulfilled_at, cancelled_at, refunded_at, merch_order_items(title_snapshot, quantity)",
    )
    .eq("buyer_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<
      {
        cancelled_at: string | null;
        created_at: string;
        currency: string;
        customer_email: string | null;
        fulfilled_at: string | null;
        id: string;
        merch_order_items: { quantity: number; title_snapshot: string }[];
        refunded_at: string | null;
        shipping_name: string | null;
        status: string;
        total_cents: number;
      }[]
    >();
  const canSubmitLicense =
    profile?.account_type &&
    verificationEligibleAccountTypes.includes(profile.account_type as string);
  const isLicenseVerified = Boolean(profile?.license_verified_at);
  const latestVerificationRequest = verificationRequests?.[0] ?? null;
  const hasPendingVerification = Boolean(
    verificationRequests?.some((request) => request.status === "pending"),
  );
  const canUploadVerification =
    Boolean(canSubmitLicense) && !isLicenseVerified && !hasPendingVerification;
  const canSubmitAds =
    canSubmitLicense && isLicenseVerified && !profile?.suspended_at && !profile?.banned_at;
  const isFirstProfile = !profile;

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden px-4 py-8">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link className="text-sm font-semibold text-[var(--background)]" href="/">
            TheTattooCore
          </Link>
          <div className="flex items-center gap-3">
            {role && adminRoles.includes(role) ? (
              <Link
                className="ttc-surface flex h-10 items-center rounded-md border px-4 text-sm font-semibold"
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <form action="/auth/signout" method="post">
              <button className="ttc-surface h-10 rounded-md border px-4 text-sm font-semibold">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {params.message ? (
          <p className="ttc-surface mb-4 rounded-md border px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <AccountSetupGuide isFirstProfile={isFirstProfile} />

        <AccountReadinessPanel
          canSubmitLicense={canSubmitLicense}
          canUploadVerification={canUploadVerification}
          hasPendingVerification={hasPendingVerification}
          isLicenseVerified={isLicenseVerified}
          profile={profile}
        />

        <nav
          aria-label="Account settings"
          className="no-scrollbar sticky top-0 z-20 mb-4 flex gap-2 overflow-x-auto rounded-md border border-[color-mix(in_srgb,var(--gold)_24%,var(--card-rim))] bg-[color-mix(in_srgb,var(--foreground)_94%,transparent)] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur"
        >
          {accountNavItems.map(([href, label]) => (
            <a
              className="flex h-10 shrink-0 items-center rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--paper-warm)_8%,transparent)] px-3 text-sm font-semibold text-[var(--background)] hover:border-[color-mix(in_srgb,var(--gold)_70%,var(--card-rim))] hover:bg-[color-mix(in_srgb,var(--gold)_15%,transparent)]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        <ProfileForm claims={claims} initialProfile={profile} />

        <section
          className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur"
          id="order-settings"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                Merch
              </p>
              <h2 className="text-xl font-bold">Orders</h2>
            </div>
            <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
              Latest 5
            </span>
          </div>
          <p className="text-sm leading-6 text-[var(--muted-strong)]">
            Merch checkout is in test mode while fulfillment, shipping, refund,
            tax, and production seller rules are finished.
          </p>
          {merchOrders?.length ? (
            <div className="mt-4 grid gap-3">
              {merchOrders.map((order) => (
                <article
                  className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                  key={order.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold">
                        Order {order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-strong)]">
                        {formatDate(order.created_at)} -{" "}
                        {Intl.NumberFormat("en-US", {
                          currency: order.currency,
                          style: "currency",
                        }).format(order.total_cents / 100)}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${orderStatusClass(
                        order.status,
                      )}`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                    {order.merch_order_items.map((item) => (
                      <p key={`${order.id}-${item.title_snapshot}`}>
                        {item.quantity} x {item.title_snapshot}
                      </p>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-strong)] sm:grid-cols-2">
                    <p>Ship to: {order.shipping_name || "Not collected"}</p>
                    <p>Email: {order.customer_email || claims.email || "Not collected"}</p>
                    {order.fulfilled_at ? (
                      <p>Fulfilled: {formatDate(order.fulfilled_at)}</p>
                    ) : null}
                    {order.refunded_at ? (
                      <p>Refunded: {formatDate(order.refunded_at)}</p>
                    ) : null}
                    {order.cancelled_at ? (
                      <p>Cancelled: {formatDate(order.cancelled_at)}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
              No Merch orders yet.
            </p>
          )}
        </section>

        <section
          className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur"
          id="data-settings"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                Data control
              </p>
              <h2 className="text-xl font-bold">Account and data</h2>
            </div>
            <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
              Manual review
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            You can make your profile private anytime. Account deletion is a
            manual review request during launch so safety reports, marketplace
            issues, and legal obligations can be handled correctly.
          </p>
          {deletionRequests?.length ? (
            <div className="mt-4 grid gap-2">
              {deletionRequests.map((request) => (
                <div
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold capitalize">
                      {request.status} deletion request
                    </p>
                    <p className="text-xs text-[var(--muted-strong)]">
                      {formatDate(request.requested_at)}
                    </p>
                  </div>
                  {request.reviewer_note ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                      {request.reviewer_note}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <form action={requestAccountDeletion} className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-sm font-medium">Reason, optional</span>
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]"
                maxLength={500}
                name="delete_reason"
                placeholder="Tell admins what should be reviewed before deletion."
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Type DELETE to request account deletion
              </span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="delete_confirmation"
                placeholder="DELETE"
              />
            </label>
            <PendingSubmitButton
              className="h-11 w-fit rounded-md border border-[color-mix(in_srgb,var(--danger)_55%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-5 text-sm font-semibold text-[var(--danger)]"
              pendingLabel="Submitting"
            >
              Request account deletion
            </PendingSubmitButton>
          </form>
          <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
            For urgent privacy or safety help, use the public support page.
          </p>
        </section>

        {canSubmitLicense ? (
          <section
            className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur"
            id="verification-settings"
          >
            <div className="mb-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    Professional access
                  </p>
                  <h2 className="text-xl font-bold">
                    Artist, studio, and vendor verification
                  </h2>
                </div>
                <span
                  className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${
                    isLicenseVerified
                      ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                      : hasPendingVerification
                        ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]"
                        : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] text-[var(--muted)]"
                  }`}
                >
                  {isLicenseVerified
                    ? "Verified"
                    : hasPendingVerification
                      ? "Pending"
                      : "Not verified"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
                Upload your tattoo license, shop license, certification,
                vendor business license, or local proof that you can legally
                tattoo, operate, or sell as a body-art vendor. Documents are
                private and reviewed by authorized admins.
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--muted-strong)]">
                Accepted files: PDF, JPG, PNG, or WebP up to 10 MB.
              </p>
              <div className="mt-4 grid gap-2">
                {verificationStandards.map((standard) => (
                  <p
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"
                    key={standard}
                  >
                    {standard}
                  </p>
                ))}
              </div>
              {isLicenseVerified ? (
                <p className="mt-3 rounded-md bg-[var(--foreground)] px-3 py-2 text-sm font-semibold text-white">
                  Your {profile?.account_type} profile is license verified.
                </p>
              ) : null}
            </div>

            {verificationRequests?.length ? (
              <div className="mb-5 space-y-2">
                {verificationRequests.map((request) => (
                  <div
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm"
                    key={request.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{request.license_name}</p>
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${verificationStatusClass(
                          request.status,
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-strong)]">
                      {request.issuing_region} - Submitted{" "}
                      {formatDate(request.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-strong)]">
                      Expires {formatDate(request.expires_on)}
                      {isExpiredDate(request.expires_on) ? " - expired" : ""}
                      {request.reviewed_at
                        ? ` - Reviewed ${formatDate(request.reviewed_at)}`
                        : ""}
                    </p>
                    {request.status === "pending" ? (
                      <p className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 py-2 text-xs leading-5 text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]">
                        This request is waiting for admin review. New uploads
                        open again if it is rejected.
                      </p>
                    ) : null}
                    {request.status === "rejected" && request.reviewer_note ? (
                      <p className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-3 py-2 text-xs leading-5 text-[var(--danger)]">
                        Admin note: {request.reviewer_note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!canUploadVerification ? (
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
                {isLicenseVerified
                  ? "Your verification is active. Keep a current license or business document ready for renewal when we add renewal reminders."
                  : "Your latest request is pending review. You can submit updated proof if an admin rejects it."}
              </div>
            ) : null}

            {canUploadVerification ? (
              <form action={submitLicenseVerification} className="grid gap-4">
                {latestVerificationRequest?.status === "rejected" ? (
                  <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
                    Submit updated proof after fixing the last rejection note.
                  </p>
                ) : null}
                <label className="block">
                  <span className="text-sm font-medium">
                    License or certification name <span className="text-[var(--danger)]">*</span>
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="license_name"
                    placeholder="Tattoo artist license"
                    required
                  />
                </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">
                    License number
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="license_number"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">
                    Issuing city/state/country <span className="text-[var(--danger)]">*</span>
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="issuing_region"
                    placeholder="Austin, TX"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Expiration date</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="expires_on"
                    type="date"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">
                    License document <span className="text-[var(--danger)]">*</span>
                  </span>
                  <div className="mt-2">
                    <LicenseDocumentInput
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      name="license_document"
                      required
                    />
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
                    Private admin review only. Public users only see verified status after approval.
                  </span>
                </label>
              </div>

              <PendingSubmitButton
                className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-white"
                pendingLabel="Submitting"
              >
                Submit for review
              </PendingSubmitButton>
              </form>
            ) : null}
          </section>
        ) : (
          <section
            className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] p-5 backdrop-blur"
            id="verification-settings"
          >
            <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
              Professional access
            </p>
            <h2 className="text-xl font-bold">Artist, studio, and vendor verification</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Choose Artist, Studio, or Vendor as your account type and save
              your profile to submit license, certification, or business
              documents.
            </p>
            <div className="mt-4 grid gap-2">
              {verificationStandards.map((standard) => (
                <p
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"
                  key={standard}
                >
                  {standard}
                </p>
              ))}
            </div>
          </section>
        )}

        <section
          className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur"
          id="advertising-settings"
        >
          <div className="mb-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                  Sponsored spots
                </p>
                <h2 className="text-xl font-bold">Advertising</h2>
              </div>
              <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
                {canSubmitAds ? "Open" : "Locked"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
              Verified artists, studios, and vendors can submit simple campaigns
              for admin review. Artist growth ads can run in 4U and Gossip.
              Stuff ads stay in Stuff.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {advertisingStandards.map((standard) => (
                <p
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted)]"
                  key={standard}
                >
                  {standard}
                </p>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3">
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                Review rules
              </p>
              <ul className="mt-2 grid gap-2 text-xs leading-5 text-[var(--muted)]">
                {advertisingReviewRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>

          {adCampaigns?.length ? (
            <div className="mb-5 grid gap-3">
              {adCampaigns.map((campaign) => {
                const clicks = campaign.ad_events.filter(
                  (event) => event.event_type === "click",
                ).length;
                const impressions = campaign.ad_events.filter(
                  (event) => event.event_type === "impression",
                ).length;

                return (
                  <article
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm"
                    key={campaign.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{campaign.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted-strong)]">
                          {campaign.title}
                        </p>
                      </div>
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize">
                        {adLabel(campaign.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]">
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1 capitalize">
                        {adLabel(campaign.goal)}
                      </span>
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1">
                        {campaign.ad_campaign_placements
                          .map((placement) => adLabel(placement.placement))
                          .join(", ") || "No placement"}
                      </span>
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1">
                        {dollars(campaign.bid_cents)} bid /{" "}
                        {dollars(campaign.daily_budget_cents)} daily cap
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Impressions", impressions],
                        ["Clicks", clicks],
                        ["CTR", adClickRate({ clicks, impressions })],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-2"
                          key={label}
                        >
                          <p className="font-bold text-[var(--foreground)]">{value}</p>
                          <p className="mt-1 text-[var(--muted-strong)]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!canSubmitAds ? (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              Advertising opens after an artist, studio, or vendor account is
              license verified and in good standing.
            </div>
          ) : (
            <form action={submitAdCampaign} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Campaign type</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="campaign_type"
                    required
                  >
                    <option value="artist_growth">Artist growth</option>
                    <option value="stuff_listing">Stuff listing</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Goal</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="goal"
                    required
                  >
                    <option value="leads">Leads</option>
                    <option value="messages">Messages</option>
                    <option value="engagement">Engagement</option>
                    <option value="listing_views">Stuff listing views</option>
                    <option value="seller_messages">Stuff seller messages</option>
                    <option value="marketplace_engagement">
                      Stuff marketplace engagement
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Campaign name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    maxLength={120}
                    name="name"
                    placeholder="Austin flash booking push"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Ad headline</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    maxLength={120}
                    name="title"
                    placeholder="Books open for July"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium">Ad text</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]"
                  maxLength={300}
                  name="body"
                  placeholder="Short ad copy for the sponsored card."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Target link</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="target_url"
                    placeholder="https://..."
                    type="url"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Keywords</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="keywords"
                    placeholder="blackwork, flash, fine line"
                  />
                </label>
              </div>

              <fieldset className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3">
                <legend className="px-1 text-sm font-semibold">Placements</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    ["4u", "4U"],
                    ["gossip", "Gossip"],
                    ["stuff", "Stuff"],
                  ].map(([value, label]) => (
                    <label
                      className="flex items-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm font-medium"
                      key={value}
                    >
                      <input name="placements" type="checkbox" value={value} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
                  Artist growth can use 4U and Gossip. Stuff listing campaigns
                  can use Stuff only.
                </p>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Bid per spot</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    min="0"
                    name="bid_dollars"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Daily cap</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    min="0"
                    name="daily_budget_dollars"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="text-sm font-medium">City</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={profile?.city ?? ""}
                    name="city"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Region</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={profile?.region ?? ""}
                    name="region"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Country</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm uppercase outline-none focus:border-[var(--foreground)]"
                    defaultValue={profile?.country_code ?? ""}
                    name="country_code"
                  >
                    <option value="">Any country</option>
                    {countryOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Language</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={profile?.preferred_language ?? ""}
                    name="language"
                  >
                    <option value="">Any language</option>
                    {languageOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                Ads are reviewed before they run and appear with a sponsored
                label. Targeting uses coarse location, language, selected
                placement, and keywords only.
              </p>

              <PendingSubmitButton
                className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-white"
                pendingLabel="Submitting"
              >
                Submit ad for review
              </PendingSubmitButton>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
