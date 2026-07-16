import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  cancelAcceptedBookingAsArtist,
  cancelBookingRequest,
  createBookingAppointmentType,
  createBookingBlackoutDate,
  createBookingSlot,
  deleteBookingAppointmentType,
  deleteBookingBlackoutDate,
  deleteBookingSlot,
  markMerchSaleFulfilled,
  requestAccountDeletion,
  requestBookingRefundReview,
  requestMerchRefundReview,
  respondBookingRequest,
  submitAdCampaign,
  submitLicenseVerification,
  toggleBookingAppointmentType,
  toggleBookingSlot,
  updateBookingAppointmentType,
  updateBookingBlackoutDate,
  updateBookingSettings,
  updateBookingSlot,
} from "./actions";
import { AdCampaignForm } from "./ad-campaign-form";
import { LicenseDocumentInput } from "./license-document-input";
import { ProfileForm } from "./profile-form";
import { PendingSubmitButton } from "../pending-submit-button";
import { countryOptions, languageOptions } from "@/lib/localization";
import {
  accountDeletionStatusLabel,
  bookingPaymentStatusLabel,
  bookingStatusLabel,
  calendarConnectionStatusLabel,
  commerceStatusLabel,
  fulfillmentStatusLabel,
  titleCaseStatus,
} from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { verificationEligibleAccountTypes } from "@/lib/verification";

type Claims = {
  sub: string;
  email?: string;
};

type BookingSettings = {
  booking_enabled: boolean;
  booking_note: string | null;
  booking_url: string | null;
  calendar_connection_status: string;
  calendar_notes: string | null;
  cancellation_policy: string | null;
  default_deposit_amount_cents: number;
  deposit_policy: string;
  timezone: string;
  weekly_availability: {
    summary?: string | null;
  } | null;
};
type BookingAppointmentType = {
  buffer_after_minutes: number;
  buffer_before_minutes: number;
  deposit_amount_cents: number;
  deposit_policy: string;
  description: string | null;
  duration_minutes: number;
  id: string;
  is_active: boolean;
  name: string;
};
type BookingSlot = {
  appointment_type_id: string | null;
  ends_at: string;
  id: string;
  is_active: boolean;
  max_bookings_per_slot: number;
  slot_interval_minutes: number;
  starts_at: string;
  timezone: string;
  weekday: number;
};
type BookingBlackout = {
  ends_at: string;
  id: string;
  is_all_day: boolean;
  reason: string | null;
  starts_at: string;
};
type SellerPayoutAccount = {
  charges_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  last_synced_at: string | null;
  onboarding_started_at: string | null;
  payouts_enabled: boolean;
  requirements_currently_due: string[];
};

const adminRoles = ["moderator", "admin", "owner"];
const adPageSize = 25;
const bookingPageSize = 25;
const orderPageSize = 25;
const bookingStatusFilters = [
  "requested",
  "accepted",
  "deposit_paid",
  "declined",
  "cancelled",
  "completed",
] as const;
const accountNavItems = [
  ["#profile-settings", "Profile"],
  ["#appearance-settings", "Appearance"],
  ["#language-settings", "Language"],
  ["#privacy-settings", "Privacy"],
  ["#notification-settings", "Notifications"],
  ["#verification-settings", "Verify"],
  ["#booking-settings", "Bookings"],
  ["#advertising-settings", "Ads"],
  ["#order-settings", "Orders"],
  ["#data-settings", "Data"],
] as const;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const slotIntervals = [15, 20, 30, 45, 60, 90, 120] as const;
const bookingCalendarPrepItems = [
  [
    "Manual calendar plan",
    "Use your current booking or calendar request link while TTC handles requests, deposits, and private calendar downloads.",
  ],
  [
    "Appointment cards",
    "Accepted bookings with a scheduled time give both people a private Add to calendar download.",
  ],
  [
    "Calendar sync later",
    "Google, Apple, or iCalendar account sync can be added after launch payment and policy review.",
  ],
] as const;
const merchSellerReadinessItems = [
  [
    "Seller payout path",
    "Seller payout setup uses a secure hosted flow. TTC forms never ask for raw bank, routing, card, or debit payout numbers.",
  ],
  [
    "Fulfillment gate",
    "Mark items fulfilled only after a paid order is ready for shipping, pickup, or handoff.",
  ],
  [
    "Review trail",
    "Refunds, disputes, and unusual order issues stay in admin review during launch testing.",
  ],
] as const;

function limitParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? String(orderPageSize), 10);

  if (!Number.isFinite(parsed)) return orderPageSize;

  return Math.max(orderPageSize, Math.min(250, parsed));
}

function bookingStatusParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue && bookingStatusFilters.includes(rawValue as (typeof bookingStatusFilters)[number])
    ? rawValue
    : null;
}

function adLimitHref({ adLimit, orderLimit }: { adLimit: number; orderLimit: number }) {
  return `/account?ads=${adLimit}&orders=${orderLimit}#advertising-settings`;
}

function orderLimitHref({ adLimit, orderLimit }: { adLimit: number; orderLimit: number }) {
  return `/account?ads=${adLimit}&orders=${orderLimit}#order-settings`;
}

function bookingLimitHref({
  adLimit,
  bookingLimit,
  bookingStatus,
  orderLimit,
}: {
  adLimit: number;
  bookingLimit: number;
  bookingStatus?: string | null;
  orderLimit: number;
}) {
  const status = bookingStatus ? `&booking_status=${bookingStatus}` : "";

  return `/account?ads=${adLimit}&bookings=${bookingLimit}&orders=${orderLimit}${status}#booking-settings`;
}

function bookingStatusHref({
  adLimit,
  bookingStatus,
  orderLimit,
}: {
  adLimit: number;
  bookingStatus: string | null;
  orderLimit: number;
}) {
  const status = bookingStatus ? `&booking_status=${bookingStatus}` : "";

  return `/account?ads=${adLimit}&bookings=${bookingPageSize}&orders=${orderLimit}${status}#booking-settings`;
}

function accountLoginPath({
  adLimit,
  bookingLimit,
  bookingStatus,
  orderLimit,
}: {
  adLimit: number;
  bookingLimit: number;
  bookingStatus?: string | null;
  orderLimit: number;
}) {
  const status = bookingStatus ? `&booking_status=${bookingStatus}` : "";
  const returnTo =
    adLimit !== adPageSize ||
    bookingLimit !== bookingPageSize ||
    orderLimit !== orderPageSize ||
    Boolean(bookingStatus)
      ? `/account?ads=${adLimit}&bookings=${bookingLimit}&orders=${orderLimit}${status}`
      : "/account";

  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

function AccountSetupGuide({
  isFirstProfile,
}: {
  isFirstProfile: boolean;
}) {
  const steps = [
    ["1", "Save profile", "Choose a username, account type, country, language, and confirm 18+."],
    ["2", "Start posting", "Use the bottom-right plus button from 4U, Gossip, Stuff, Gigs, or Merch."],
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

  return titleCaseStatus(value);
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
  "Merch campaigns stay in Merch and focus on product views, shop visits, and safe fan purchases.",
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

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function shippingAddressLines(value: unknown) {
  if (!value || typeof value !== "object") return [];

  const root = value as {
    address?: Record<string, unknown>;
    name?: unknown;
  };
  const address = root.address && typeof root.address === "object" ? root.address : {};
  const text = (key: string) =>
    typeof address[key] === "string" ? String(address[key]).trim() : "";
  const cityStatePostal = [text("city"), text("state"), text("postal_code")]
    .filter(Boolean)
    .join(", ");

  return [
    typeof root.name === "string" ? root.name.trim() : "",
    text("line1"),
    text("line2"),
    cityStatePostal,
    text("country"),
  ].filter(Boolean);
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

function formatBookingDateTime(value: string | null, timezone?: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + (timezone ? ` ${timezone}` : "");
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
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)]"
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
  searchParams: Promise<{
    ads?: string | string[];
    booking_status?: string | string[];
    bookings?: string | string[];
    message?: string;
    orders?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const adLimit = limitParam(params.ads);
  const bookingLimit = limitParam(params.bookings);
  const bookingStatusFilter = bookingStatusParam(params.booking_status);
  const orderLimit = limitParam(params.orders);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect(
      accountLoginPath({
        adLimit,
        bookingLimit,
        bookingStatus: bookingStatusFilter,
        orderLimit,
      }),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "username, display_name, avatar_url, banner_url, account_type, bio, city, region, country_code, preferred_language, theme_preference, location_personalization_enabled, is_adult_confirmed, is_private, adult_terms_accepted_at, website_url, instagram_url, tiktok_url, facebook_url, youtube_url, x_url, shop_profile_id, license_verified_at, suspended_at, banned_at, role, notify_follow_activity, notify_message_activity, notify_feed_activity, notify_thread_activity, notify_marketplace_gig_activity, notification_quiet_hours_enabled, notification_quiet_hours_start, notification_quiet_hours_end, notification_timezone, notify_email_important, notify_push_enabled",
    )
    .eq("id", claims.sub)
    .maybeSingle();
  const { data: shopProfile } = profile?.shop_profile_id
    ? await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", profile.shop_profile_id)
        .maybeSingle<{ display_name: string; username: string }>()
    : { data: null };

  const canManageBookingSettings = Boolean(
    profile?.account_type &&
      ["artist", "studio"].includes(profile.account_type as string) &&
      profile.license_verified_at &&
      !profile.suspended_at &&
      !profile.banned_at,
  );
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
      "id, name, title, campaign_type, goal, status, payment_status, prepaid_amount_cents, platform_fee_cents, bid_cents, daily_budget_cents, created_at, ad_campaign_placements(placement), ad_events(event_type)",
    )
    .eq("advertiser_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(adLimit + 1)
    .returns<
      {
        ad_events: { event_type: "impression" | "click" | "message_lead" }[];
        ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" | "merch" }[];
        bid_cents: number;
        campaign_type: string;
        created_at: string;
        daily_budget_cents: number;
        goal: string;
        id: string;
        name: string;
        payment_status: string;
        platform_fee_cents: number;
        prepaid_amount_cents: number;
        status: string;
        title: string;
      }[]
    >();
  const { data: adCredits } = await supabase
    .from("ad_credit_ledger")
    .select("amount_cents, used_cents, status")
    .eq("profile_id", claims.sub)
    .eq("status", "active")
    .returns<
      {
        amount_cents: number;
        status: string;
        used_cents: number;
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
      "id, status, currency, subtotal_cents, platform_fee_cents, shipping_cents, tax_cents, discount_cents, total_cents, customer_email, shipping_name, stripe_payment_intent_id, created_at, fulfilled_at, cancelled_at, refunded_at, merch_order_items(title_snapshot, quantity, fulfillment_status, seller_fulfilled_at, tracking_carrier, tracking_number, tracking_url)",
    )
    .eq("buyer_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(orderLimit + 1)
    .returns<
      {
        cancelled_at: string | null;
        created_at: string;
        currency: string;
        customer_email: string | null;
        discount_cents: number;
        fulfilled_at: string | null;
        id: string;
        merch_order_items: {
          fulfillment_status: string;
          quantity: number;
          seller_fulfilled_at: string | null;
          title_snapshot: string;
          tracking_carrier: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
        }[];
        platform_fee_cents: number;
        refunded_at: string | null;
        shipping_cents: number;
        shipping_name: string | null;
        status: string;
        stripe_payment_intent_id: string | null;
        subtotal_cents: number;
        tax_cents: number;
        total_cents: number;
      }[]
    >();
  const { data: merchSales } = await supabase
    .from("merch_order_items")
    .select(
      "id, order_id, title_snapshot, quantity, unit_price_cents, line_total_cents, currency, fulfillment_status, seller_fulfilled_at, tracking_carrier, tracking_number, tracking_url, created_at, merch_orders(id, status, customer_email, shipping_name, shipping_address, created_at, fulfilled_at, cancelled_at, refunded_at)",
    )
    .eq("seller_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(orderLimit + 1)
    .returns<
      {
        created_at: string;
        currency: string;
        fulfillment_status: string;
        id: string;
        line_total_cents: number;
        merch_orders: {
          cancelled_at: string | null;
          created_at: string;
          customer_email: string | null;
          fulfilled_at: string | null;
          id: string;
          refunded_at: string | null;
          shipping_address: Record<string, unknown> | null;
          shipping_name: string | null;
          status: string;
        } | null;
        order_id: string;
        quantity: number;
        seller_fulfilled_at?: string | null;
        title_snapshot: string;
        tracking_carrier?: string | null;
        tracking_number?: string | null;
        tracking_url?: string | null;
        unit_price_cents: number;
      }[]
    >();
  const { data: merchProducts } = await supabase
    .from("merch_products")
    .select(
      "id, title, category, status, moderation_status, price_cents, currency, inventory_quantity, inventory_reserved, is_official, created_at, reviewed_at, reviewer_note",
    )
    .eq("seller_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(orderLimit + 1)
    .returns<
      {
        category: string;
        created_at: string;
        currency: string;
        id: string;
        inventory_quantity: number;
        inventory_reserved: number;
        is_official: boolean;
        moderation_status: string;
        price_cents: number;
        reviewed_at: string | null;
        reviewer_note: string | null;
        status: string;
        title: string;
      }[]
    >();
  const { data: sellerPayoutAccount } = await supabase
    .from("stripe_connect_accounts")
    .select(
      "charges_enabled, payouts_enabled, details_submitted, disabled_reason, requirements_currently_due, onboarding_started_at, last_synced_at",
    )
    .eq("profile_id", claims.sub)
    .maybeSingle<SellerPayoutAccount>();
  const { data: incomingBookings } = await (() => {
    let query = supabase
      .from("booking_requests")
      .select(
        "id, title, body, placement, style_tags, preferred_city, preferred_dates, appointment_type_label, preferred_slot_label, deposit_amount_cents, platform_fee_cents, total_cents, currency, status, payment_status, artist_note, scheduled_start_at, scheduled_end_at, scheduled_timezone, created_at, accepted_at, declined_at, client:profiles!booking_requests_client_id_fkey(username, display_name, avatar_url)",
      )
      .eq("artist_id", claims.sub);

    if (bookingStatusFilter) {
      query = query.eq("status", bookingStatusFilter);
    }

    return query
      .order("created_at", { ascending: false })
      .limit(bookingLimit + 1)
      .returns<
        {
          accepted_at: string | null;
          appointment_type_label: string | null;
          artist_note: string | null;
          body: string;
          client: {
            avatar_url: string | null;
            display_name: string;
            username: string;
          } | null;
          created_at: string;
          currency: string;
          declined_at: string | null;
          deposit_amount_cents: number;
          id: string;
          payment_status: string;
          placement: string | null;
          platform_fee_cents: number;
          preferred_city: string | null;
          preferred_dates: string | null;
          preferred_slot_label: string | null;
          scheduled_end_at: string | null;
          scheduled_start_at: string | null;
          scheduled_timezone: string | null;
          status: string;
          style_tags: string | null;
          title: string;
          total_cents: number;
        }[]
      >();
  })();
  const { data: bookingSettings } = await supabase
    .from("booking_settings")
    .select(
      "booking_enabled, timezone, weekly_availability, booking_note, booking_url, calendar_notes, cancellation_policy, deposit_policy, default_deposit_amount_cents, calendar_connection_status",
    )
    .eq("profile_id", claims.sub)
    .maybeSingle<BookingSettings>();
  const { data: bookingAppointmentTypes } = canManageBookingSettings
    ? await supabase
        .from("booking_appointment_types")
        .select(
          "id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, deposit_policy, deposit_amount_cents, is_active",
        )
        .eq("profile_id", claims.sub)
        .order("is_active", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(25)
        .returns<BookingAppointmentType[]>()
    : { data: null };
  const { data: bookingSlots } = canManageBookingSettings
    ? await supabase
        .from("booking_availability_slots")
        .select(
          "id, appointment_type_id, weekday, starts_at, ends_at, timezone, slot_interval_minutes, max_bookings_per_slot, is_active",
        )
        .eq("profile_id", claims.sub)
        .order("weekday", { ascending: true })
        .order("starts_at", { ascending: true })
        .limit(50)
        .returns<BookingSlot[]>()
    : { data: null };
  const { data: bookingBlackouts } = canManageBookingSettings
    ? await supabase
        .from("booking_blackout_dates")
        .select("id, starts_at, ends_at, reason, is_all_day")
        .eq("profile_id", claims.sub)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(25)
        .returns<BookingBlackout[]>()
    : { data: null };
  const { data: outgoingBookings } = await (() => {
    let query = supabase
      .from("booking_requests")
      .select(
        "id, title, body, placement, style_tags, preferred_city, preferred_dates, appointment_type_label, preferred_slot_label, deposit_amount_cents, platform_fee_cents, total_cents, currency, status, payment_status, artist_note, scheduled_start_at, scheduled_end_at, scheduled_timezone, created_at, accepted_at, declined_at, artist:profiles!booking_requests_artist_id_fkey(username, display_name, avatar_url)",
      )
      .eq("client_id", claims.sub);

    if (bookingStatusFilter) {
      query = query.eq("status", bookingStatusFilter);
    }

    return query
      .order("created_at", { ascending: false })
      .limit(bookingLimit + 1)
      .returns<
        {
          accepted_at: string | null;
          appointment_type_label: string | null;
          artist: {
            avatar_url: string | null;
            display_name: string;
            username: string;
          } | null;
          artist_note: string | null;
          body: string;
          created_at: string;
          currency: string;
          declined_at: string | null;
          deposit_amount_cents: number;
          id: string;
          payment_status: string;
          placement: string | null;
          platform_fee_cents: number;
          preferred_city: string | null;
          preferred_dates: string | null;
          preferred_slot_label: string | null;
          scheduled_end_at: string | null;
          scheduled_start_at: string | null;
          scheduled_timezone: string | null;
          status: string;
          style_tags: string | null;
          title: string;
          total_cents: number;
        }[]
      >();
  })();
  const visibleMerchOrders = (merchOrders ?? []).slice(0, orderLimit);
  const hasMoreMerchOrders = (merchOrders?.length ?? 0) > orderLimit;
  const visibleMerchSales = (merchSales ?? []).slice(0, orderLimit);
  const hasMoreMerchSales = (merchSales?.length ?? 0) > orderLimit;
  const visibleMerchProducts = (merchProducts ?? []).slice(0, orderLimit);
  const hasMoreMerchProducts = (merchProducts?.length ?? 0) > orderLimit;
  const visibleIncomingBookings = (incomingBookings ?? []).slice(0, bookingLimit);
  const visibleOutgoingBookings = (outgoingBookings ?? []).slice(0, bookingLimit);
  const hasMoreBookings =
    (incomingBookings?.length ?? 0) > bookingLimit ||
    (outgoingBookings?.length ?? 0) > bookingLimit;
  const visibleAdCampaigns = (adCampaigns ?? []).slice(0, adLimit);
  const hasMoreAdCampaigns = (adCampaigns?.length ?? 0) > adLimit;
  const adCreditBalanceCents = (adCredits ?? []).reduce(
    (total, credit) =>
      credit.status === "active"
        ? total + Math.max(0, credit.amount_cents - credit.used_cents)
        : total,
    0,
  );
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
  const canSetupSellerPayouts =
    canSubmitAds &&
    Boolean(
      profile?.account_type &&
        ["artist", "studio", "vendor"].includes(profile.account_type as string),
    );
  const sellerPayoutReady = Boolean(
    sellerPayoutAccount?.charges_enabled &&
      sellerPayoutAccount.payouts_enabled &&
      sellerPayoutAccount.details_submitted,
  );
  const isFirstProfile = !profile;
  const normalizedProfile = profile
    ? {
        ...profile,
        shop_profile: shopProfile ?? null,
      }
    : null;

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden px-4 py-8">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link className="text-sm font-semibold text-[var(--foreground)]" href="/">
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
          className="no-scrollbar sticky top-0 z-20 mb-4 flex gap-2 overflow-x-auto rounded-md border border-[color-mix(in_srgb,var(--gold)_24%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.14)] backdrop-blur"
        >
          {accountNavItems.map(([href, label]) => (
            <a
              className="flex h-10 shrink-0 items-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--gold)_70%,var(--card-rim))] hover:bg-[color-mix(in_srgb,var(--gold)_15%,var(--paper-warm))]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        <ProfileForm claims={claims} initialProfile={normalizedProfile} />

        <section
          className="ttc-card mt-6 scroll-mt-20 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur"
          id="booking-settings"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                Appointments
              </p>
              <h2 className="text-xl font-bold">Booking requests</h2>
            </div>
            <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
              Latest {bookingLimit}
            </span>
          </div>
          <p className="text-sm leading-6 text-[var(--muted-strong)]">
            Booking requests are request-first during launch. Artists and
            studios accept or decline here; deposit checkout will open
            only after acceptance and will include the TTC processing fee.
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Link
              className={`h-9 shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                !bookingStatusFilter
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] text-[var(--foreground)]"
              }`}
              href={bookingStatusHref({
                adLimit,
                bookingStatus: null,
                orderLimit,
              })}
            >
              All
            </Link>
            {bookingStatusFilters.map((status) => (
              <Link
                className={`h-9 shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                  bookingStatusFilter === status
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] text-[var(--foreground)]"
                }`}
                href={bookingStatusHref({
                  adLimit,
                  bookingStatus: status,
                  orderLimit,
                })}
                key={status}
              >
                {bookingStatusLabel(status)}
              </Link>
            ))}
          </div>

          {canManageBookingSettings ? (
            <>
            <form
              action={updateBookingSettings}
              className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--gold)_32%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold">Booking availability</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Share your public booking link or calendar request link
                    while managing appointment requests here.
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 py-2 text-sm font-semibold">
                  <input
                    defaultChecked={bookingSettings?.booking_enabled ?? false}
                    name="booking_enabled"
                    type="checkbox"
                  />
                  Show booking availability
                </label>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {bookingCalendarPrepItems.map(([title, body]) => (
                  <div
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3"
                    key={title}
                  >
                    <p className="text-sm font-bold">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Timezone
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.timezone ?? "America/Chicago"}
                    maxLength={80}
                    name="booking_timezone"
                    placeholder="America/Chicago"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Deposit policy
                  <select
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.deposit_policy ?? "optional"}
                    name="deposit_policy"
                  >
                    <option value="optional">Optional per request</option>
                    <option value="required">Usually required</option>
                    <option value="none">No deposit</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Default deposit
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={
                      bookingSettings?.default_deposit_amount_cents
                        ? (bookingSettings.default_deposit_amount_cents / 100).toFixed(2)
                        : ""
                    }
                    inputMode="decimal"
                    name="default_deposit_amount"
                    placeholder="50.00"
                  />
                  <span className="text-xs font-normal leading-5 text-[var(--muted-strong)]">
                    Required deposit settings need a default amount so clients
                    see the expected deposit before they request a booking.
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Calendar connection
                  <select
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.calendar_connection_status ?? "manual"}
                    name="calendar_connection_status"
                  >
                    <option value="manual">Manual setup</option>
                    <option value="google_planned">Google calendar later</option>
                    <option value="apple_ical_planned">
                      Apple or iCalendar later
                    </option>
                  </select>
                  <span className="text-xs font-normal leading-5 text-[var(--muted-strong)]">
                    Current:{" "}
                    {calendarConnectionStatusLabel(
                      bookingSettings?.calendar_connection_status,
                    )}
                    . Add your public booking page or calendar request link
                    below.
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Public booking link
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.booking_url ?? ""}
                    maxLength={500}
                    name="booking_url"
                    placeholder="https://your-booking-page.example"
                    type="url"
                  />
                  <span className="text-xs font-normal leading-5 text-[var(--muted-strong)]">
                    Use a public booking, calendar, or request page you already
                    trust. Members will open it in a new tab.
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Weekly availability
                  <textarea
                    className="min-h-24 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.weekly_availability?.summary ?? ""}
                    maxLength={500}
                    name="availability_summary"
                    placeholder="Example: Tue-Fri 12-7, Saturdays by appointment, closed Sunday/Monday."
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Calendar notes
                  <textarea
                    className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.calendar_notes ?? ""}
                    maxLength={500}
                    name="calendar_notes"
                    placeholder="Example: check my public booking link first, then send a DM for deposit questions."
                  />
                  <span className="text-xs font-normal leading-5 text-[var(--muted-strong)]">
                    Good place for calendar instructions, booking-window notes,
                    or which days you usually approve.
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Booking note
                  <textarea
                    className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.booking_note ?? ""}
                    maxLength={500}
                    name="booking_note"
                    placeholder="Consultation notes, deposit expectations, preferred contact, or booking window."
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Cancellation policy
                  <textarea
                    className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    defaultValue={bookingSettings?.cancellation_policy ?? ""}
                    maxLength={500}
                    name="cancellation_policy"
                    placeholder="Example: deposits are reviewed case by case; reschedules need 48 hours notice."
                  />
                </label>
              </div>
              <PendingSubmitButton
                className="mt-4 h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                pendingLabel="Saving"
              >
                Save booking availability
              </PendingSubmitButton>
            </form>
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <div>
                  <h3 className="text-sm font-bold">Appointment types</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Create consultation or tattoo session types with duration,
                    buffers, and deposit rules.
                  </p>
                </div>
                <form action={createBookingAppointmentType} className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm font-semibold">
                    Name
                    <input
                      className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                      maxLength={80}
                      name="appointment_name"
                      placeholder="Consultation"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Description
                    <textarea
                      className="min-h-16 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                      maxLength={500}
                      name="appointment_description"
                      placeholder="Small tattoo consult, sleeve planning, touch-up review..."
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm font-semibold">
                      Minutes
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="60"
                        inputMode="numeric"
                        name="duration_minutes"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Buffer before
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="0"
                        inputMode="numeric"
                        name="buffer_before_minutes"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Buffer after
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="0"
                        inputMode="numeric"
                        name="buffer_after_minutes"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      Deposit rule
                      <select
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="inherit"
                        name="appointment_deposit_policy"
                      >
                        <option value="inherit">Use account default</option>
                        <option value="optional">Optional</option>
                        <option value="required">Required</option>
                        <option value="none">No deposit</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Deposit amount
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        inputMode="decimal"
                        name="appointment_deposit_amount"
                        placeholder="50.00"
                      />
                    </label>
                  </div>
                  <PendingSubmitButton
                    className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                    pendingLabel="Adding"
                  >
                    Add appointment type
                  </PendingSubmitButton>
                </form>
                <div className="mt-4 grid gap-2">
                  {(bookingAppointmentTypes ?? []).length ? (
                    bookingAppointmentTypes?.map((type) => (
                      <article
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-3"
                        key={type.id}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold">{type.name}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                              {type.duration_minutes} min
                              {type.buffer_before_minutes || type.buffer_after_minutes
                                ? ` - buffer ${type.buffer_before_minutes}/${type.buffer_after_minutes} min`
                                : ""}{" "}
                              - {type.deposit_policy}
                              {type.deposit_amount_cents
                                ? ` - ${money(type.deposit_amount_cents, "USD")}`
                                : ""}
                            </p>
                            {type.description ? (
                              <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                                {type.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <form action={toggleBookingAppointmentType}>
                              <input
                                name="appointment_type_id"
                                type="hidden"
                                value={type.id}
                              />
                              <input
                                name="is_active"
                                type="hidden"
                                value={String(!type.is_active)}
                              />
                              <PendingSubmitButton
                                className="h-9 rounded-md border border-[var(--card-rim)] px-3 text-xs font-bold"
                                pendingLabel="Saving"
                              >
                                {type.is_active ? "Pause" : "Restore"}
                              </PendingSubmitButton>
                            </form>
                            <form action={deleteBookingAppointmentType}>
                              <input
                                name="appointment_type_id"
                                type="hidden"
                                value={type.id}
                              />
                              <PendingSubmitButton
                                className="h-9 rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] px-3 text-xs font-bold text-[var(--danger)]"
                                pendingLabel="Deleting"
                              >
                                Delete
                              </PendingSubmitButton>
                            </form>
                          </div>
                        </div>
                        <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_86%,transparent)] p-3">
                          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
                            Edit details
                          </summary>
                          <form
                            action={updateBookingAppointmentType}
                            className="mt-3 grid gap-3"
                          >
                            <input
                              name="appointment_type_id"
                              type="hidden"
                              value={type.id}
                            />
                            <label className="grid gap-1 text-sm font-semibold">
                              Name
                              <input
                                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                defaultValue={type.name}
                                maxLength={80}
                                name="appointment_name"
                                required
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-semibold">
                              Description
                              <textarea
                                className="min-h-16 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                defaultValue={type.description ?? ""}
                                maxLength={500}
                                name="appointment_description"
                              />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="grid gap-1 text-sm font-semibold">
                                Minutes
                                <input
                                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                  defaultValue={type.duration_minutes}
                                  inputMode="numeric"
                                  name="duration_minutes"
                                />
                              </label>
                              <label className="grid gap-1 text-sm font-semibold">
                                Buffer before
                                <input
                                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                  defaultValue={type.buffer_before_minutes}
                                  inputMode="numeric"
                                  name="buffer_before_minutes"
                                />
                              </label>
                              <label className="grid gap-1 text-sm font-semibold">
                                Buffer after
                                <input
                                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                  defaultValue={type.buffer_after_minutes}
                                  inputMode="numeric"
                                  name="buffer_after_minutes"
                                />
                              </label>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1 text-sm font-semibold">
                                Deposit rule
                                <select
                                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                  defaultValue={type.deposit_policy}
                                  name="appointment_deposit_policy"
                                >
                                  <option value="inherit">Use account default</option>
                                  <option value="optional">Optional</option>
                                  <option value="required">Required</option>
                                  <option value="none">No deposit</option>
                                </select>
                              </label>
                              <label className="grid gap-1 text-sm font-semibold">
                                Deposit amount
                                <input
                                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                  defaultValue={
                                    type.deposit_amount_cents
                                      ? (type.deposit_amount_cents / 100).toFixed(2)
                                      : ""
                                  }
                                  inputMode="decimal"
                                  name="appointment_deposit_amount"
                                />
                              </label>
                            </div>
                            <PendingSubmitButton
                              className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                              pendingLabel="Saving"
                            >
                              Save appointment type
                            </PendingSubmitButton>
                          </form>
                        </details>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-[var(--card-rim)] p-3 text-sm text-[var(--muted)]">
                      No appointment types yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <div>
                  <h3 className="text-sm font-bold">Weekly slot templates</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Add repeatable days and times. Blackouts below can block
                    travel, conventions, or private days.
                  </p>
                </div>
                <form action={createBookingSlot} className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      Day
                      <select
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        name="slot_weekday"
                      >
                        {weekdays.map((day, index) => (
                          <option key={day} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Type
                      <select
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        name="slot_appointment_type_id"
                      >
                        <option value="">Any appointment type</option>
                        {(bookingAppointmentTypes ?? [])
                          .filter((type) => type.is_active)
                          .map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      Starts
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="10:00"
                        name="slot_starts_at"
                        type="time"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Ends
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="17:00"
                        name="slot_ends_at"
                        type="time"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm font-semibold">
                      Interval
                      <select
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="30"
                        name="slot_interval_minutes"
                      >
                        {slotIntervals.map((interval) => (
                          <option key={interval} value={interval}>
                            {interval} min
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Capacity
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue="1"
                        inputMode="numeric"
                        name="max_bookings_per_slot"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Timezone
                      <input
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                        defaultValue={bookingSettings?.timezone ?? "America/Chicago"}
                        maxLength={80}
                        name="slot_timezone"
                      />
                    </label>
                  </div>
                  <PendingSubmitButton
                    className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                    pendingLabel="Adding"
                  >
                    Add slot template
                  </PendingSubmitButton>
                </form>
                <div className="mt-4 grid gap-2">
                  {(bookingSlots ?? []).length ? (
                    bookingSlots?.map((slot) => {
                      const type = bookingAppointmentTypes?.find(
                        (item) => item.id === slot.appointment_type_id,
                      );

                      return (
                        <article
                          className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-3"
                          key={slot.id}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-bold">
                                {weekdays[slot.weekday] ?? "Day"}{" "}
                                {slot.starts_at.slice(0, 5)}-{slot.ends_at.slice(0, 5)}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted-strong)]">
                                {type?.name ?? "Any type"} - every{" "}
                                {slot.slot_interval_minutes} min - capacity{" "}
                                {slot.max_bookings_per_slot}
                                {!slot.is_active ? " - paused" : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <form action={toggleBookingSlot}>
                                <input name="slot_id" type="hidden" value={slot.id} />
                                <input
                                  name="is_active"
                                  type="hidden"
                                  value={String(!slot.is_active)}
                                />
                                <PendingSubmitButton
                                  className="h-9 rounded-md border border-[var(--card-rim)] px-3 text-xs font-bold"
                                  pendingLabel="Saving"
                                >
                                  {slot.is_active ? "Pause" : "Restore"}
                                </PendingSubmitButton>
                              </form>
                              <form action={deleteBookingSlot}>
                                <input name="slot_id" type="hidden" value={slot.id} />
                                <PendingSubmitButton
                                  className="h-9 rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] px-3 text-xs font-bold text-[var(--danger)]"
                                  pendingLabel="Removing"
                                >
                                  Remove
                                </PendingSubmitButton>
                              </form>
                            </div>
                          </div>
                          <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_86%,transparent)] p-3">
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
                              Edit slot
                            </summary>
                            <form action={updateBookingSlot} className="mt-3 grid gap-3">
                              <input name="slot_id" type="hidden" value={slot.id} />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1 text-sm font-semibold">
                                  Day
                                  <select
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.weekday}
                                    name="slot_weekday"
                                  >
                                    {weekdays.map((day, index) => (
                                      <option key={day} value={index}>
                                        {day}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1 text-sm font-semibold">
                                  Type
                                  <select
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.appointment_type_id ?? ""}
                                    name="slot_appointment_type_id"
                                  >
                                    <option value="">Any appointment type</option>
                                    {(bookingAppointmentTypes ?? []).map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1 text-sm font-semibold">
                                  Starts
                                  <input
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.starts_at.slice(0, 5)}
                                    name="slot_starts_at"
                                    type="time"
                                  />
                                </label>
                                <label className="grid gap-1 text-sm font-semibold">
                                  Ends
                                  <input
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.ends_at.slice(0, 5)}
                                    name="slot_ends_at"
                                    type="time"
                                  />
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="grid gap-1 text-sm font-semibold">
                                  Interval
                                  <select
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.slot_interval_minutes}
                                    name="slot_interval_minutes"
                                  >
                                    {slotIntervals.map((interval) => (
                                      <option key={interval} value={interval}>
                                        {interval} min
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1 text-sm font-semibold">
                                  Capacity
                                  <input
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.max_bookings_per_slot}
                                    inputMode="numeric"
                                    name="max_bookings_per_slot"
                                  />
                                </label>
                                <label className="grid gap-1 text-sm font-semibold">
                                  Timezone
                                  <input
                                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                    defaultValue={slot.timezone}
                                    maxLength={80}
                                    name="slot_timezone"
                                  />
                                </label>
                              </div>
                              <PendingSubmitButton
                                className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                                pendingLabel="Saving"
                              >
                                Save slot template
                              </PendingSubmitButton>
                            </form>
                          </details>
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-md border border-dashed border-[var(--card-rim)] p-3 text-sm text-[var(--muted)]">
                      No weekly slot templates yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
              <div>
                <h3 className="text-sm font-bold">Blackout dates</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Block conventions, travel, private days, or shop closures
                  before they become bookable.
                </p>
              </div>
              <form action={createBookingBlackoutDate} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Starts
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    name="blackout_starts_at"
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Ends
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    name="blackout_ends_at"
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                  Reason
                  <input
                    className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    maxLength={160}
                    name="blackout_reason"
                    placeholder="Convention, travel, private booking, shop closure..."
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input name="blackout_all_day" type="checkbox" />
                  All day
                </label>
                <PendingSubmitButton
                  className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                  pendingLabel="Adding"
                >
                  Add blackout
                </PendingSubmitButton>
              </form>
              <div className="mt-4 grid gap-2">
                {(bookingBlackouts ?? []).length ? (
                  bookingBlackouts?.map((blackout) => (
                    <article
                      className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-3"
                      key={blackout.id}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold">
                            {formatDate(blackout.starts_at)} - {formatDate(blackout.ends_at)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-strong)]">
                            {blackout.reason ?? "Blocked time"}
                            {blackout.is_all_day ? " - all day" : ""}
                          </p>
                        </div>
                        <form action={deleteBookingBlackoutDate}>
                          <input name="blackout_id" type="hidden" value={blackout.id} />
                          <PendingSubmitButton
                            className="h-9 rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] px-3 text-xs font-bold text-[var(--danger)]"
                            pendingLabel="Removing"
                          >
                            Remove
                          </PendingSubmitButton>
                        </form>
                      </div>
                      <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_86%,transparent)] p-3">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
                          Edit blackout
                        </summary>
                        <form
                          action={updateBookingBlackoutDate}
                          className="mt-3 grid gap-3 md:grid-cols-2"
                        >
                          <input name="blackout_id" type="hidden" value={blackout.id} />
                          <label className="grid gap-1 text-sm font-semibold">
                            Starts
                            <input
                              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                              defaultValue={blackout.starts_at.slice(0, 16)}
                              name="blackout_starts_at"
                              type="datetime-local"
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-semibold">
                            Ends
                            <input
                              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                              defaultValue={blackout.ends_at.slice(0, 16)}
                              name="blackout_ends_at"
                              type="datetime-local"
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                            Reason
                            <input
                              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                              defaultValue={blackout.reason ?? ""}
                              maxLength={160}
                              name="blackout_reason"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm font-semibold">
                            <input
                              defaultChecked={blackout.is_all_day}
                              name="blackout_all_day"
                              type="checkbox"
                            />
                            All day
                          </label>
                          <PendingSubmitButton
                            className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)]"
                            pendingLabel="Saving"
                          >
                            Save blackout
                          </PendingSubmitButton>
                        </form>
                      </details>
                    </article>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-[var(--card-rim)] p-3 text-sm text-[var(--muted)]">
                    No upcoming blackout dates.
                  </p>
                )}
              </div>
            </section>
            </>
          ) : (
            <div className="mt-5 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              Verified artist or studio status unlocks public booking
              availability, calendar preparation, and deposit settings.
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">Incoming</h3>
              {visibleIncomingBookings.length ? (
                <div className="mt-3 grid gap-3">
                  {visibleIncomingBookings.map((booking) => {
                    const canRespond =
                      booking.status === "requested" &&
                      booking.payment_status === "not_ready";
                    const canCancelAcceptedBooking =
                      booking.status === "accepted" &&
                      ["not_ready", "payment_failed"].includes(booking.payment_status);

                    return (
                      <article
                        className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                        key={booking.id}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold">{booking.title}</p>
                            <p className="mt-1 text-xs text-[var(--muted-strong)]">
                              From{" "}
                              {booking.client ? (
                                <Link
                                  className="font-semibold underline"
                                  href={`/u/${booking.client.username}`}
                                >
                                  @{booking.client.username}
                                </Link>
                              ) : (
                                "member"
                              )}{" "}
                              - {formatDate(booking.created_at)}
                            </p>
                          </div>
                          <span
                            className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${orderStatusClass(
                              booking.status,
                            )}`}
                          >
                            {bookingStatusLabel(booking.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                          {booking.body}
                        </p>
                        <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--muted-strong)]">
                          <p>
                            Deposit: {money(booking.deposit_amount_cents, booking.currency)}
                            {" "}+ TTC fee{" "}
                            {money(booking.platform_fee_cents, booking.currency)}
                          </p>
                          <p>
                            Total checkout:{" "}
                            {money(
                              booking.deposit_amount_cents + booking.platform_fee_cents,
                              booking.currency,
                            )}
                          </p>
                          {booking.placement ? <p>Placement: {booking.placement}</p> : null}
                          {booking.style_tags ? <p>Style: {booking.style_tags}</p> : null}
                          {booking.preferred_city ? <p>City: {booking.preferred_city}</p> : null}
                          {booking.appointment_type_label ? (
                            <p>Type: {booking.appointment_type_label}</p>
                          ) : null}
                          {booking.preferred_slot_label ? (
                            <p>Preferred slot: {booking.preferred_slot_label}</p>
                          ) : null}
                          {booking.preferred_dates ? (
                            <p>Dates: {booking.preferred_dates}</p>
                          ) : null}
                          {booking.scheduled_start_at ? (
                            <p>
                              Scheduled:{" "}
                              {formatBookingDateTime(
                                booking.scheduled_start_at,
                                booking.scheduled_timezone,
                              )}
                            </p>
                          ) : null}
                          {booking.artist_note ? <p>Note: {booking.artist_note}</p> : null}
                        </div>
                        {canRespond ? (
                          <form action={respondBookingRequest} className="mt-4 grid gap-2">
                            <input name="booking_id" type="hidden" value={booking.id} />
                            <input
                              name="scheduled_timezone"
                              type="hidden"
                              value={bookingSettings?.timezone ?? "America/Chicago"}
                            />
                            <textarea
                              className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                              maxLength={1000}
                              name="artist_note"
                              placeholder="Optional note for the client"
                            />
                            <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
                              Final deposit amount
                              <input
                                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                                defaultValue={
                                  booking.deposit_amount_cents
                                    ? (booking.deposit_amount_cents / 100).toFixed(2)
                                    : ""
                                }
                                inputMode="decimal"
                                name="final_deposit_amount"
                                placeholder="Example: 100"
                              />
                              <span className="text-[11px] font-normal leading-4 text-[var(--muted-strong)]">
                                This is the deposit checkout amount before the
                                TTC fee is added.
                              </span>
                            </label>
                            <details className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                              <summary className="cursor-pointer list-none text-xs font-bold">
                                Add appointment time
                              </summary>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <label className="grid gap-1 text-xs font-semibold">
                                  Start
                                  <input
                                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                                    name="scheduled_start_at"
                                    type="datetime-local"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold">
                                  End
                                  <input
                                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                                    name="scheduled_end_at"
                                    type="datetime-local"
                                  />
                                </label>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
                                Saved in {bookingSettings?.timezone ?? "America/Chicago"} for calendar export.
                              </p>
                            </details>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <PendingSubmitButton
                                className="h-10 rounded-md border border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] px-4 text-sm font-bold text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                                name="decision"
                                pendingLabel="Accepting"
                                value="accept"
                              >
                                Accept
                              </PendingSubmitButton>
                              <PendingSubmitButton
                                className="h-10 rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)]"
                                name="decision"
                                pendingLabel="Declining"
                                value="decline"
                              >
                                Decline
                              </PendingSubmitButton>
                            </div>
                          </form>
                        ) : null}
                        {booking.scheduled_start_at ? (
                          <Link
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 text-xs font-bold"
                            href={`/api/bookings/${booking.id}/calendar`}
                          >
                            Add to calendar
                          </Link>
                        ) : null}
                        {booking.status === "deposit_paid" &&
                        booking.payment_status === "paid" ? (
                          <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                            <summary className="cursor-pointer list-none text-xs font-bold">
                              Request refund review
                            </summary>
                            <form action={requestBookingRefundReview} className="mt-3 grid gap-2">
                              <input name="booking_id" type="hidden" value={booking.id} />
                              <textarea
                                className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                                maxLength={500}
                                name="refund_reason"
                                placeholder="Reason for admin review"
                              />
                              <PendingSubmitButton
                                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                                pendingLabel="Requesting"
                              >
                                Send review request
                              </PendingSubmitButton>
                            </form>
                          </details>
                        ) : null}
                        {canCancelAcceptedBooking ? (
                          <form action={cancelAcceptedBookingAsArtist} className="mt-3">
                            <input name="booking_id" type="hidden" value={booking.id} />
                            <PendingSubmitButton
                              className="h-10 w-full rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)] sm:w-fit"
                              pendingLabel="Cancelling"
                            >
                              Cancel accepted booking
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
                  No incoming booking requests yet.
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold">Sent</h3>
              {visibleOutgoingBookings.length ? (
                <div className="mt-3 grid gap-3">
                  {visibleOutgoingBookings.map((booking) => {
                    const canCancelBooking =
                      ["requested", "accepted"].includes(booking.status) &&
                      ["not_ready", "payment_failed"].includes(booking.payment_status);

                    return (
                    <article
                      className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                      key={booking.id}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold">{booking.title}</p>
                          <p className="mt-1 text-xs text-[var(--muted-strong)]">
                            To{" "}
                            {booking.artist ? (
                              <Link
                                className="font-semibold underline"
                                href={`/u/${booking.artist.username}`}
                              >
                                @{booking.artist.username}
                              </Link>
                            ) : (
                              "artist"
                            )}{" "}
                            - {formatDate(booking.created_at)}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${orderStatusClass(
                            booking.status,
                          )}`}
                        >
                          {bookingStatusLabel(booking.status)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                        {booking.body}
                      </p>
                      <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--muted-strong)]">
                        <p>
                          Deposit: {money(booking.deposit_amount_cents, booking.currency)}
                          {" "}+ TTC fee{" "}
                          {money(booking.platform_fee_cents, booking.currency)}
                        </p>
                        <p>
                          Total checkout:{" "}
                          {money(
                            booking.deposit_amount_cents + booking.platform_fee_cents,
                            booking.currency,
                          )}
                        </p>
                        <p>Payment: {bookingPaymentStatusLabel(booking.payment_status)}</p>
                        {booking.accepted_at ? (
                          <p>Accepted: {formatDate(booking.accepted_at)}</p>
                        ) : null}
                        {booking.declined_at ? (
                          <p>Declined: {formatDate(booking.declined_at)}</p>
                        ) : null}
                        {booking.appointment_type_label ? (
                          <p>Type: {booking.appointment_type_label}</p>
                        ) : null}
                        {booking.preferred_slot_label ? (
                          <p>Preferred slot: {booking.preferred_slot_label}</p>
                        ) : null}
                        {booking.artist_note ? <p>Artist note: {booking.artist_note}</p> : null}
                        {booking.scheduled_start_at ? (
                          <p>
                            Scheduled:{" "}
                            {formatBookingDateTime(
                              booking.scheduled_start_at,
                              booking.scheduled_timezone,
                            )}
                          </p>
                        ) : null}
                      </div>
                      {booking.scheduled_start_at ? (
                        <Link
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 text-xs font-bold"
                          href={`/api/bookings/${booking.id}/calendar`}
                        >
                          Add to calendar
                        </Link>
                      ) : null}
                      {booking.status === "deposit_paid" &&
                      booking.payment_status === "paid" ? (
                        <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                          <summary className="cursor-pointer list-none text-xs font-bold">
                            Request refund review
                          </summary>
                          <form action={requestBookingRefundReview} className="mt-3 grid gap-2">
                            <input name="booking_id" type="hidden" value={booking.id} />
                            <textarea
                              className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                              maxLength={500}
                              name="refund_reason"
                              placeholder="Reason for admin review"
                            />
                            <PendingSubmitButton
                              className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                              pendingLabel="Requesting"
                            >
                              Send review request
                            </PendingSubmitButton>
                          </form>
                        </details>
                      ) : null}
                      {booking.status === "accepted" &&
                      booking.payment_status !== "paid" &&
                      booking.deposit_amount_cents > 0 ? (
                        <form
                          action="/api/bookings/checkout"
                          className="mt-4"
                          method="post"
                        >
                          <input
                            name="booking_id"
                            type="hidden"
                            value={booking.id}
                          />
                          <button
                            className="h-10 w-full rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                            disabled={booking.payment_status === "checkout_started"}
                          >
                            {booking.payment_status === "checkout_started"
                              ? "Checkout started"
                              : "Pay deposit"}
                          </button>
                        </form>
                      ) : null}
                      {canCancelBooking ? (
                        <form action={cancelBookingRequest} className="mt-3">
                          <input name="booking_id" type="hidden" value={booking.id} />
                          <PendingSubmitButton
                            className="h-10 w-full rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)] sm:w-fit"
                            pendingLabel="Cancelling"
                          >
                            Cancel request
                          </PendingSubmitButton>
                        </form>
                      ) : null}
                    </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
                  No sent booking requests yet.
                </p>
              )}
            </div>
          </div>
          {hasMoreBookings ? (
            <Link
              className="mt-4 flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
              href={bookingLimitHref({
                adLimit,
                bookingLimit: bookingLimit + bookingPageSize,
                bookingStatus: bookingStatusFilter,
                orderLimit,
              })}
            >
              Load {bookingPageSize} more booking requests
            </Link>
          ) : null}
        </section>

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
              Latest {visibleMerchOrders.length || orderLimit}
            </span>
          </div>
          <p className="text-sm leading-6 text-[var(--muted-strong)]">
            Merch checkout is limited during launch while seller and order rules
            are finished. Additional order tools will appear here as they open.
          </p>
          {visibleMerchOrders.length ? (
            <div className="mt-4 grid gap-3">
              {visibleMerchOrders.map((order) => (
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
                        {money(order.total_cents, order.currency)}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${orderStatusClass(
                        order.status,
                      )}`}
                    >
                      {commerceStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                    {order.merch_order_items.map((item) => (
                      <div
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_84%,transparent)] p-2"
                        key={`${order.id}-${item.title_snapshot}`}
                      >
                        <p className="font-semibold text-[var(--foreground)]">
                          {item.quantity} x {item.title_snapshot}
                        </p>
                        <div className="mt-1 space-y-1 text-xs leading-5 text-[var(--muted-strong)]">
                          <p className="capitalize">
                            Fulfillment: {fulfillmentStatusLabel(item.fulfillment_status)}
                          </p>
                          {item.seller_fulfilled_at ? (
                            <p>
                              Seller fulfilled: {formatDate(item.seller_fulfilled_at)}
                            </p>
                          ) : null}
                          {item.tracking_carrier || item.tracking_number ? (
                            <p>
                              Tracking: {[item.tracking_carrier, item.tracking_number]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                          ) : null}
                          {item.tracking_url ? (
                            <p>
                              Tracking link:{" "}
                              <a
                                className="font-semibold underline"
                                href={item.tracking_url}
                                rel="ugc nofollow noopener noreferrer"
                                target="_blank"
                              >
                                Open
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-[var(--muted-strong)]">
                      Subtotal{" "}
                      {money(order.subtotal_cents, order.currency)}
                      {" "}+ TTC fee{" "}
                      {money(order.platform_fee_cents, order.currency)}
                      {order.shipping_cents > 0
                        ? ` + shipping ${money(order.shipping_cents, order.currency)}`
                        : ""}
                      {order.tax_cents > 0
                        ? ` + tax ${money(order.tax_cents, order.currency)}`
                        : ""}
                      {order.discount_cents > 0
                        ? ` - discount ${money(order.discount_cents, order.currency)}`
                        : ""}
                    </p>
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
                  {["paid", "fulfilled"].includes(order.status) &&
                  !order.refunded_at &&
                  !order.cancelled_at &&
                  order.stripe_payment_intent_id ? (
                    <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3">
                      <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
                        Request refund review
                      </summary>
                      <form
                        action={requestMerchRefundReview}
                        className="mt-3 space-y-2"
                      >
                        <input name="order_id" type="hidden" value={order.id} />
                        <textarea
                          className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                          maxLength={500}
                          name="refund_reason"
                          placeholder="Briefly explain the refund issue for admin review."
                        />
                        <PendingSubmitButton
                          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-3 text-sm font-bold text-[var(--background)]"
                          pendingLabel="Sending..."
                        >
                          Send refund review request
                        </PendingSubmitButton>
                        <p className="text-xs leading-5 text-[var(--muted-strong)]">
                          This does not send money automatically. An admin
                          reviews the order, seller fulfillment, and payment
                          status first.
                        </p>
                      </form>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
              No Merch orders yet.
            </p>
          )}
          {hasMoreMerchOrders ? (
            <Link
              className="mt-4 flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
              href={orderLimitHref({
                adLimit,
                orderLimit: orderLimit + orderPageSize,
              })}
            >
              Load {orderPageSize} more orders
            </Link>
          ) : null}

          <div className="mt-8 border-t border-[var(--card-rim)] pt-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                  Seller view
                </p>
                <h3 className="text-lg font-bold">Merch sales</h3>
              </div>
              <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
                Latest {visibleMerchSales.length || orderLimit}
              </span>
            </div>
            <p className="text-sm leading-6 text-[var(--muted-strong)]">
              Sales show paid or pending checkout items that belong to your
              products. Mark paid line items fulfilled only after shipping or
              handoff is complete; refunds and disputes still need admin/payment
              review during launch.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {merchSellerReadinessItems.map(([title, body]) => (
                <div
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3"
                  key={title}
                >
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_28%,var(--card-rim))] bg-[color-mix(in_srgb,var(--paper-warm)_92%,var(--gold)_8%)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    Seller payout setup
                  </p>
                  <h4 className="mt-1 text-base font-bold">
                    {sellerPayoutReady
                      ? "Payout setup ready"
                      : sellerPayoutAccount
                        ? "Payout setup needs review"
                        : "Set up seller payouts"}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {canSetupSellerPayouts
                      ? "Use the secure hosted setup flow for seller payout details. TTC stores payout readiness status only, not bank or card credentials."
                      : "Verified artist, studio, or vendor status is required before seller payout setup opens."}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${
                    sellerPayoutReady
                      ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                      : "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]"
                  }`}
                >
                  {sellerPayoutReady ? "Ready" : "Setup needed"}
                </span>
              </div>
              {sellerPayoutAccount ? (
                <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-strong)] sm:grid-cols-3">
                  <p>Charges: {sellerPayoutAccount.charges_enabled ? "Ready" : "Not ready"}</p>
                  <p>Payouts: {sellerPayoutAccount.payouts_enabled ? "Ready" : "Not ready"}</p>
                  <p>
                    Details: {sellerPayoutAccount.details_submitted ? "Submitted" : "Needed"}
                  </p>
                  {sellerPayoutAccount.disabled_reason ? (
                    <p className="sm:col-span-3">
                      Status note: {sellerPayoutAccount.disabled_reason}
                    </p>
                  ) : null}
                  {sellerPayoutAccount.requirements_currently_due.length ? (
                    <p className="sm:col-span-3">
                      More details may be required in the hosted setup flow.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canSetupSellerPayouts ? (
                <form
                  action="/api/stripe/connect/onboarding"
                  className="mt-4"
                  method="post"
                >
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                    pendingLabel="Opening setup"
                  >
                    {sellerPayoutAccount ? "Continue payout setup" : "Start payout setup"}
                  </PendingSubmitButton>
                </form>
              ) : null}
            </div>
            <div className="mt-6 border-t border-[var(--card-rim)] pt-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    Seller products
                  </p>
                  <h3 className="text-lg font-bold">Your Merch products</h3>
                </div>
                <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
                  Latest {visibleMerchProducts.length || orderLimit}
                </span>
              </div>
              <p className="text-sm leading-6 text-[var(--muted-strong)]">
                Submitted products stay here while admin reviews them. Active or
                owner-visible products can be opened for edits, inventory updates,
                and archive controls.
              </p>
              {visibleMerchProducts.length ? (
                <div className="mt-4 grid gap-3">
                  {visibleMerchProducts.map((product) => {
                    const available =
                      product.inventory_quantity - product.inventory_reserved;
                    const reviewLabel =
                      product.moderation_status === "active"
                        ? "Review clear"
                        : titleCaseStatus(product.moderation_status);

                    return (
                      <article
                        className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                        key={product.id}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {product.title}
                            </p>
                            <p className="mt-1 text-xs capitalize text-[var(--muted-strong)]">
                              {product.category.replaceAll("_", " ")} -{" "}
                              {money(product.price_cents, product.currency)} -{" "}
                              {formatDate(product.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${orderStatusClass(
                                product.status,
                              )}`}
                            >
                              {titleCaseStatus(product.status)}
                            </span>
                            <span
                              className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${orderStatusClass(
                                product.moderation_status,
                              )}`}
                            >
                              {reviewLabel}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-strong)] sm:grid-cols-3">
                          <p>Available: {Intl.NumberFormat("en-US").format(available)}</p>
                          <p>Inventory: {Intl.NumberFormat("en-US").format(product.inventory_quantity)}</p>
                          <p>Reserved: {Intl.NumberFormat("en-US").format(product.inventory_reserved)}</p>
                          {product.reviewed_at ? (
                            <p>Reviewed: {formatDate(product.reviewed_at)}</p>
                          ) : null}
                          {product.is_official ? <p>Official TTC product</p> : null}
                        </div>
                        {product.reviewer_note ? (
                          <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
                            Admin note: {product.reviewer_note}
                          </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                            href={`/merch/${product.id}`}
                          >
                            Open product
                          </Link>
                          <Link
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
                            href="/merch"
                          >
                            View Merch
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
                  No Merch products yet. Verified sellers can submit products
                  from the Merch column plus button.
                </p>
              )}
              {hasMoreMerchProducts ? (
                <Link
                  className="mt-4 flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
                  href={orderLimitHref({
                    adLimit,
                    orderLimit: orderLimit + orderPageSize,
                  })}
                >
                  Load {orderPageSize} more products
                </Link>
              ) : null}
            </div>
            {visibleMerchSales.length ? (
              <div className="mt-4 grid gap-3">
                {visibleMerchSales.map((item) => {
                  const order = item.merch_orders;
                  const canMarkFulfilled =
                    order?.status === "paid" &&
                    item.fulfillment_status === "unfulfilled";
                  const addressLines = shippingAddressLines(order?.shipping_address);

                  return (
                    <article
                      className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
                      key={item.id}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold">
                            {item.quantity} x {item.title_snapshot}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-strong)]">
                            Order {(order?.id ?? item.order_id).slice(0, 8)} -{" "}
                            {formatDate(order?.created_at ?? item.created_at)}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${orderStatusClass(
                            order?.status ?? item.fulfillment_status,
                          )}`}
                        >
                          {order
                            ? commerceStatusLabel(order.status)
                            : fulfillmentStatusLabel(item.fulfillment_status)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                        <p>
                          Line total: {money(item.line_total_cents, item.currency)}
                        </p>
                        <p>
                          Unit price: {money(item.unit_price_cents, item.currency)}
                        </p>
                        <p>Fulfillment: {fulfillmentStatusLabel(item.fulfillment_status)}</p>
                        <p>Ship to: {order?.shipping_name || "Not collected"}</p>
                        <p>Email: {order?.customer_email || "Not collected"}</p>
                        {order?.fulfilled_at ? (
                          <p>Fulfilled: {formatDate(order.fulfilled_at)}</p>
                        ) : null}
                        {order?.refunded_at ? (
                          <p>Refunded: {formatDate(order.refunded_at)}</p>
                        ) : null}
                        {order?.cancelled_at ? (
                          <p>Cancelled: {formatDate(order.cancelled_at)}</p>
                        ) : null}
                        {item.seller_fulfilled_at ? (
                          <p>Seller fulfilled: {formatDate(item.seller_fulfilled_at)}</p>
                        ) : null}
                        {item.tracking_carrier || item.tracking_number ? (
                          <p>
                            Tracking: {[item.tracking_carrier, item.tracking_number]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        ) : null}
                        {item.tracking_url ? (
                          <p>
                            Tracking link:{" "}
                            <a
                              className="font-semibold underline"
                              href={item.tracking_url}
                              rel="ugc nofollow noopener noreferrer"
                              target="_blank"
                            >
                              Open
                            </a>
                          </p>
                        ) : null}
                      </div>
                      {addressLines.length ? (
                        <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
                          <p className="font-bold uppercase text-[var(--muted-strong)]">
                            Shipping address
                          </p>
                          <address className="mt-2 not-italic">
                            {addressLines.map((line) => (
                              <span className="block" key={line}>
                                {line}
                              </span>
                            ))}
                          </address>
                        </div>
                      ) : null}
                      <form action={markMerchSaleFulfilled} className="mt-4">
                        <input
                          name="order_item_id"
                          type="hidden"
                          value={item.id}
                        />
                        {canMarkFulfilled ? (
                          <details className="mb-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3">
                            <summary className="cursor-pointer text-sm font-bold">
                              Add optional shipping details
                            </summary>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <input
                                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                                maxLength={80}
                                name="tracking_carrier"
                                placeholder="Carrier"
                              />
                              <input
                                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                                maxLength={120}
                                name="tracking_number"
                                placeholder="Tracking number"
                              />
                              <input
                                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)] sm:col-span-3"
                                maxLength={500}
                                name="tracking_url"
                                placeholder="Tracking link"
                                type="url"
                              />
                            </div>
                          </details>
                        ) : null}
                        <PendingSubmitButton
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[var(--ink)] px-4 text-sm font-bold text-white sm:w-fit"
                          disabled={!canMarkFulfilled}
                          pendingLabel="Updating"
                        >
                          {item.fulfillment_status === "fulfilled"
                            ? "Fulfilled"
                            : order?.status === "paid"
                              ? "Mark fulfilled"
                              : "Awaiting paid order"}
                        </PendingSubmitButton>
                      </form>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
                No Merch sales yet.
              </p>
            )}
            {hasMoreMerchSales ? (
              <Link
                className="mt-4 flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-4 text-sm font-semibold"
                href={orderLimitHref({
                  adLimit,
                  orderLimit: orderLimit + orderPageSize,
                })}
              >
                Load {orderPageSize} more sales
              </Link>
            ) : null}
          </div>
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
                    <p className="font-semibold">
                      {accountDeletionStatusLabel(request.status)} deletion request
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
                <p className="mt-3 rounded-md bg-[var(--foreground)] px-3 py-2 text-sm font-semibold text-[var(--background)]">
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
              <form
                action={submitLicenseVerification}
                className="grid gap-4"
              >
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
                className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]"
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
              <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-2 py-1 text-xs font-semibold">
                Latest {visibleAdCampaigns.length || adLimit}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
              Verified artists, studios, and vendors can submit simple campaigns
              for admin review. Artist growth ads can run in 4U and Gossip.
              Stuff ads stay in Stuff. Merch ads stay in Merch.
            </p>
            <div className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--gold)_35%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] p-3">
              <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                Available ad credit
              </p>
              <p className="mt-1 text-2xl font-bold">
                {dollars(adCreditBalanceCents)}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                If your credit covers a campaign daily budget, checkout applies
                it before opening card payment.
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

          {visibleAdCampaigns.length ? (
            <div className="mb-5 grid gap-3">
              {visibleAdCampaigns.map((campaign) => {
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
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-semibold capitalize">
                        {adLabel(campaign.payment_status)}
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
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-2 py-1">
                        {dollars(campaign.prepaid_amount_cents)} prepaid /{" "}
                        {dollars(campaign.platform_fee_cents)} TTC fee
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
                    {!["paid", "waived", "checkout_started"].includes(
                      campaign.payment_status,
                    ) && campaign.daily_budget_cents > 0 ? (
                      <form action="/api/ads/checkout" className="mt-3" method="post">
                        <input
                          name="campaign_id"
                          type="hidden"
                          value={campaign.id}
                        />
                        <input
                          name="return_to"
                          type="hidden"
                          value="/account#advertising-settings"
                        />
                        <button className="h-10 w-full rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                          {adCreditBalanceCents >= campaign.daily_budget_cents
                            ? `Use ${dollars(campaign.daily_budget_cents)} ad credit`
                            : `Pay ${dollars(campaign.daily_budget_cents)} ad budget`}
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          {hasMoreAdCampaigns ? (
            <Link
              className="mb-5 flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
              href={adLimitHref({
                adLimit: adLimit + adPageSize,
                orderLimit,
              })}
            >
              Load {adPageSize} more ads
            </Link>
          ) : null}

          {!canSubmitAds ? (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              Advertising opens after an artist, studio, or vendor account is
              license verified and in good standing.
            </div>
          ) : (
            <AdCampaignForm
              action={submitAdCampaign}
              city={profile?.city ?? ""}
              countryCode={profile?.country_code ?? ""}
              countryOptions={countryOptions}
              language={profile?.preferred_language ?? ""}
              languageOptions={languageOptions}
              region={profile?.region ?? ""}
            />
          )}
        </section>
      </section>
    </main>
  );
}
