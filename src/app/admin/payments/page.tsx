import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import {
  bookingPaymentStatusLabel,
  titleCaseStatus,
} from "@/lib/status-labels";
import {
  refundBookingDeposit,
  resetStaleBookingDepositCheckouts,
} from "../actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type PaymentEvent = {
  event_id: string;
  event_type: string;
  received_at: string;
};
type PaymentAuditRecord = {
  created_at: string;
  event_type: string;
  id: string;
  profiles: { display_name: string | null; username: string | null } | null;
  summary: string | null;
  target_id: string | null;
  target_type: string | null;
};
type BookingDepositRecord = {
  artist: { display_name: string | null; username: string | null } | null;
  client: { display_name: string | null; username: string | null } | null;
  currency: string;
  deposit_amount_cents: number;
  id: string;
  payment_status: string;
  platform_fee_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  title: string;
  total_cents: number;
  updated_at: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const merchOrderStatuses = [
  "pending_checkout",
  "paid",
  "payment_failed",
  "cancelled",
  "fulfilled",
  "partially_refunded",
  "refunded",
] as const;
const adPaymentStatuses = [
  "unpaid",
  "checkout_started",
  "paid",
  "payment_failed",
  "refunded",
  "waived",
] as const;
const bookingPaymentStatuses = [
  "not_ready",
  "checkout_started",
  "paid",
  "payment_failed",
  "refunded",
  "waived",
] as const;
const paymentEventTypes = [
  "checkout.session.completed",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "refund.failed",
] as const;
const paymentAuditTypes = [
  "reset_stale_booking_deposit_checkouts",
  "refund_booking_deposit_requested",
  "merch_refund_review_requested",
  "booking_refund_review_requested",
  "booking_refund_problem",
  "ad_campaign_credit_granted",
  "user_ad_credit_granted",
  "payment_disputes",
  "merch_payment_dispute",
  "ad_payment_dispute",
  "booking_payment_dispute",
] as const;
const paymentDisputeAuditTypes = [
  "merch_payment_dispute",
  "ad_payment_dispute",
  "booking_payment_dispute",
] as const;
const productionPaymentGates = [
  "Choose a documented payout policy before real seller payouts.",
  "Finish tax, shipping-rate, refund, dispute, and chargeback procedures before public Merch orders.",
  "Finish booking refund, cancellation, appointment-confirmation, and deposit payout procedures before taking real appointment deposits.",
  "Keep seller payout details inside a secure hosted onboarding flow; do not collect bank or card payout data in TTC forms.",
  "Review platform fees, app-store rules, and payment policy before turning on production purchases.",
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Payments",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function searchTerm(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = (rawValue ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 @._:-]/g, " ")
    .replace(/\s+/g, " ");

  return normalized.slice(0, 100);
}

function pageHref(page: number, search?: string | null) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);

  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

function paymentEventFilterHref(
  eventType?: string | null,
  page = 1,
  search?: string | null,
) {
  const params = new URLSearchParams();

  if (eventType) params.set("event_type", eventType);
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);

  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

function bookingFilterHref(
  status?: string | null,
  page = 1,
  search?: string | null,
) {
  const params = new URLSearchParams();

  if (status) params.set("booking_payment_status", status);
  if (page > 1) params.set("booking_page", String(page));
  if (search) params.set("q", search);

  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

function auditFilterHref(
  auditType?: string | null,
  page = 1,
  search?: string | null,
) {
  const params = new URLSearchParams();

  if (auditType) params.set("audit_type", auditType);
  if (page > 1) params.set("audit_page", String(page));
  if (search) params.set("q", search);

  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

function Pagination({
  currentPage,
  hrefForPage = pageHref,
  itemLabel = "50",
  hasNextPage,
  totalPages,
}: {
  currentPage: number;
  hrefForPage?: (page: number) => string;
  itemLabel?: string;
  hasNextPage: boolean;
  totalPages: number;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--muted)]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
          }`}
          href={hrefForPage(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous {itemLabel}
        </Link>
        <Link
          aria-disabled={!hasNextPage}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            !hasNextPage
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          }`}
          href={hrefForPage(currentPage + 1)}
        >
          Next {itemLabel}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function staleCheckoutCutoff() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function statusLabel(value: string) {
  return titleCaseStatus(value);
}

function paymentStatusFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return bookingPaymentStatuses.includes(
    rawValue as (typeof bookingPaymentStatuses)[number],
  )
    ? rawValue
    : null;
}

function eventTypeFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return paymentEventTypes.includes(rawValue as (typeof paymentEventTypes)[number])
    ? rawValue
    : null;
}

function auditTypeFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return paymentAuditTypes.includes(rawValue as (typeof paymentAuditTypes)[number])
    ? rawValue
    : null;
}

function eventTypeLabel(value: string) {
  if (value === "checkout.session.completed") return "Checkout paid";
  if (value === "checkout.session.async_payment_failed") return "Payment failed";
  if (value === "checkout.session.expired") return "Checkout expired";
  if (value === "charge.refunded") return "Charge refunded";
  if (value === "charge.dispute.created") return "Dispute opened";
  if (value === "charge.dispute.closed") return "Dispute closed";
  if (value === "charge.dispute.funds_withdrawn") return "Funds withdrawn";
  if (value === "charge.dispute.funds_reinstated") return "Funds reinstated";
  if (value === "refund.failed") return "Refund failed";

  return value;
}

function auditLabel(value: string) {
  if (value === "reset_stale_booking_deposit_checkouts") {
    return "Reset stale booking checkouts";
  }
  if (value === "refund_booking_deposit_requested") {
    return "Booking refund requested";
  }
  if (value === "merch_refund_review_requested") {
    return "Merch refund review requested";
  }
  if (value === "booking_refund_review_requested") {
    return "Booking refund review requested";
  }
  if (value === "booking_refund_problem") return "Booking refund needs review";
  if (value === "ad_campaign_credit_granted") return "Ad credit granted";
  if (value === "user_ad_credit_granted") return "User ad credit granted";
  if (value === "payment_disputes") return "All payment disputes";
  if (value === "merch_payment_dispute") return "Merch dispute";
  if (value === "ad_payment_dispute") return "Ad dispute";
  if (value === "booking_payment_dispute") return "Booking dispute";

  return titleCaseStatus(value);
}

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

async function statusCounts({
  column,
  statuses,
  supabase,
  table,
}: {
  column: string;
  statuses: readonly string[];
  supabase: NonNullable<ReturnType<typeof createAdminClient>>;
  table: string;
}) {
  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from(table)
        .select(column, { count: "exact", head: true })
        .eq(column, status);

      return [status, count ?? 0] as const;
    }),
  );

  return results.filter(([, count]) => count > 0);
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    audit_page?: string | string[];
    audit_type?: string | string[];
    booking_payment_status?: string | string[];
    booking_page?: string | string[];
    event_type?: string | string[];
    message?: string | string[];
    page?: string | string[];
    q?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const auditCurrentPage = pageNumber(params.audit_page);
  const bookingCurrentPage = pageNumber(params.booking_page);
  const paymentAuditTypeFilter = auditTypeFilter(params.audit_type);
  const bookingPaymentStatusFilter = paymentStatusFilter(
    params.booking_payment_status,
  );
  const paymentEventTypeFilter = eventTypeFilter(params.event_type);
  const message = Array.isArray(params.message) ? params.message[0] : params.message;
  const activeSearch = searchTerm(params.q);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const auditFrom = (auditCurrentPage - 1) * pageSize;
  const auditTo = auditFrom + pageSize - 1;
  const bookingFrom = (bookingCurrentPage - 1) * pageSize;
  const bookingTo = bookingFrom + pageSize - 1;
  const staleCheckoutCreatedBefore = staleCheckoutCutoff();
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

  const adminClient = createAdminClient();
  const [
    { data: stripeEvents },
    { count: stripeEventCount },
    merchStatusCounts,
    adStatusCounts,
    bookingPaymentStatusCounts,
    { count: stalePendingCheckoutCount },
    { count: staleBookingCheckoutCount },
    { count: activeUnpaidAdCount },
    { count: paymentDisputeAuditCount },
    { count: merchRefundReviewCount },
    { count: bookingRefundReviewCount },
    { count: paymentAuditCount, data: paymentAuditLogs },
    { count: bookingDepositCount, data: recentBookingDeposits },
  ] = adminClient
    ? await Promise.all([
        (() => {
          let query = adminClient
            .from("stripe_webhook_events")
            .select("event_id, event_type, received_at", { count: "exact" })
            .order("received_at", { ascending: false });

          if (activeSearch) {
            query = query.or(
              `event_id.ilike.%${activeSearch}%,event_type.ilike.%${activeSearch}%`,
            );
          }

          if (paymentEventTypeFilter) {
            return query
              .eq("event_type", paymentEventTypeFilter)
              .range(from, to)
              .returns<PaymentEvent[]>();
          }

          return query.range(from, to).returns<PaymentEvent[]>();
        })(),
        (() => {
          let query = adminClient
            .from("stripe_webhook_events")
            .select("event_id", { count: "exact", head: true });

          if (activeSearch) {
            query = query.or(
              `event_id.ilike.%${activeSearch}%,event_type.ilike.%${activeSearch}%`,
            );
          }

          if (paymentEventTypeFilter) {
            return query.eq("event_type", paymentEventTypeFilter);
          }

          return query;
        })(),
        statusCounts({
          column: "status",
          statuses: merchOrderStatuses,
          supabase: adminClient,
          table: "merch_orders",
        }),
        statusCounts({
          column: "payment_status",
          statuses: adPaymentStatuses,
          supabase: adminClient,
          table: "ad_campaigns",
        }),
        statusCounts({
          column: "payment_status",
          statuses: bookingPaymentStatuses,
          supabase: adminClient,
          table: "booking_requests",
        }),
        adminClient
          .from("merch_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_checkout")
          .lt("created_at", staleCheckoutCreatedBefore),
        adminClient
          .from("booking_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "deposit_pending")
          .eq("payment_status", "checkout_started")
          .lt("updated_at", staleCheckoutCreatedBefore),
        adminClient
          .from("ad_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .in("payment_status", [
            "unpaid",
            "checkout_started",
            "payment_failed",
            "refunded",
          ]),
        adminClient
          .from("admin_audit_logs")
          .select("id", { count: "exact", head: true })
          .in("event_type", paymentDisputeAuditTypes),
        adminClient
          .from("admin_audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "merch_refund_review_requested"),
        adminClient
          .from("admin_audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "booking_refund_review_requested"),
        (() => {
          let query = adminClient
            .from("admin_audit_logs")
            .select(
              "id, event_type, target_type, target_id, summary, created_at, profiles:profiles!admin_audit_logs_actor_id_fkey(display_name, username)",
              { count: "exact" },
            )
            .order("created_at", { ascending: false });

          if (activeSearch) {
            query = query.or(
              `event_type.ilike.%${activeSearch}%,target_type.ilike.%${activeSearch}%,target_id.ilike.%${activeSearch}%,summary.ilike.%${activeSearch}%`,
            );
          }

          if (paymentAuditTypeFilter === "payment_disputes") {
            return query
              .in("event_type", paymentDisputeAuditTypes)
              .range(auditFrom, auditTo)
              .returns<PaymentAuditRecord[]>();
          }

          if (paymentAuditTypeFilter) {
            return query
              .eq("event_type", paymentAuditTypeFilter)
              .range(auditFrom, auditTo)
              .returns<PaymentAuditRecord[]>();
          }

          return query
            .in("event_type", paymentAuditTypes)
            .range(auditFrom, auditTo)
            .returns<PaymentAuditRecord[]>();
        })(),
        (() => {
          let query = adminClient
          .from("booking_requests")
          .select(
            "id, title, status, payment_status, deposit_amount_cents, platform_fee_cents, total_cents, currency, stripe_payment_intent_id, updated_at, client:profiles!booking_requests_client_id_fkey(display_name, username), artist:profiles!booking_requests_artist_id_fkey(display_name, username)",
            { count: "exact" },
          )
          .gt("total_cents", 0)
          .order("updated_at", { ascending: false });

          if (bookingPaymentStatusFilter) {
            query = query.eq("payment_status", bookingPaymentStatusFilter);
          }
          if (activeSearch) {
            query = query.or(
              `id.ilike.%${activeSearch}%,title.ilike.%${activeSearch}%,stripe_payment_intent_id.ilike.%${activeSearch}%`,
            );
          }

          return query.range(bookingFrom, bookingTo).returns<BookingDepositRecord[]>();
        })(),
      ])
    : [
        { data: null },
        { count: null },
        [],
        [],
        [],
        { count: null },
        { count: null },
        { count: null },
        { count: null },
        { count: null },
        { count: null },
        { count: null, data: null },
        { count: null, data: null },
      ];

  const totalStripeEvents = stripeEventCount ?? stripeEvents?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalStripeEvents / pageSize));
  const hasNextPage = currentPage < totalPages;
  const rangeStart = totalStripeEvents > 0 ? from + 1 : 0;
  const rangeEnd = Math.min(to + 1, totalStripeEvents);
  const totalPaymentAudits = paymentAuditCount ?? paymentAuditLogs?.length ?? 0;
  const auditTotalPages = Math.max(1, Math.ceil(totalPaymentAudits / pageSize));
  const auditHasNextPage = auditCurrentPage < auditTotalPages;
  const auditRangeStart = totalPaymentAudits > 0 ? auditFrom + 1 : 0;
  const auditRangeEnd = Math.min(auditTo + 1, totalPaymentAudits);
  const totalBookingDeposits =
    bookingDepositCount ?? recentBookingDeposits?.length ?? 0;
  const bookingTotalPages = Math.max(1, Math.ceil(totalBookingDeposits / pageSize));
  const bookingHasNextPage = bookingCurrentPage < bookingTotalPages;
  const bookingRangeStart = totalBookingDeposits > 0 ? bookingFrom + 1 : 0;
  const bookingRangeEnd = Math.min(bookingTo + 1, totalBookingDeposits);
  const hasPaymentWarnings =
    Boolean(stalePendingCheckoutCount) ||
    Boolean(staleBookingCheckoutCount) ||
    Boolean(activeUnpaidAdCount) ||
    Boolean(paymentDisputeAuditCount) ||
    Boolean(merchRefundReviewCount) ||
    Boolean(bookingRefundReviewCount);

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold sm:text-3xl">Payments</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Payment receipts, Merch order states, and ad payment states.
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

        <AdminSectionNav activeHref="/admin/payments" />

        {message ? (
          <p className="ttc-surface mb-4 rounded-md border px-4 py-3 text-sm font-medium">
            {message}
          </p>
        ) : null}

        {!adminClient ? (
          <section className="ttc-card rounded-lg border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--paper-warm))] p-5">
            <ShieldAlert className="size-5 text-[var(--danger)]" />
            <h2 className="mt-3 text-lg font-bold">Private payment tools unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Enable private owner tools before reading payment event receipts.
            </p>
          </section>
        ) : (
          <>
            {activeSearch ? (
              <div className="mb-4 flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">
                  Searching payment records for &ldquo;{activeSearch}&rdquo;
                </p>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 font-semibold text-[var(--foreground)]"
                  href="/admin/payments"
                >
                  Clear search
                </Link>
              </div>
            ) : null}

            <form
              action="/admin/payments"
              className="mb-4 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              {paymentEventTypeFilter ? (
                <input name="event_type" type="hidden" value={paymentEventTypeFilter} />
              ) : null}
              {paymentAuditTypeFilter ? (
                <input name="audit_type" type="hidden" value={paymentAuditTypeFilter} />
              ) : null}
              {bookingPaymentStatusFilter ? (
                <input
                  name="booking_payment_status"
                  type="hidden"
                  value={bookingPaymentStatusFilter}
                />
              ) : null}
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-bold uppercase text-[var(--muted-strong)]">
                  Search payment admin
                </span>
                <input
                  className="h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-strong)] focus:border-[var(--foreground)]"
                  defaultValue={activeSearch}
                  maxLength={100}
                  name="q"
                  placeholder="Event ID, payment intent, booking title, target ID, or audit summary"
                />
              </label>
              <button className="h-11 self-end rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                Search
              </button>
            </form>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <ReceiptText className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Payment events
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {totalStripeEvents}
                </p>
              </div>
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <CreditCard className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Merch orders
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {merchStatusCounts.reduce((sum, [, count]) => sum + count, 0)}
                </p>
              </div>
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <BadgeCheck className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Ad payment records
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {adStatusCounts.reduce((sum, [, count]) => sum + count, 0)}
                </p>
              </div>
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <CreditCard className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Booking deposits
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {bookingPaymentStatusCounts.reduce(
                    (sum, [, count]) => sum + count,
                    0,
                  )}
                </p>
              </div>
            </div>

            <section
              className={`mb-4 rounded-lg border p-4 ${
                hasPaymentWarnings
                  ? "border-[color-mix(in_srgb,var(--danger)_35%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))]"
                  : "border-[color-mix(in_srgb,#34a853_35%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_10%,var(--paper-warm))]"
              }`}
            >
              <div className="flex items-start gap-3">
                {hasPaymentWarnings ? (
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[var(--danger)]" />
                ) : (
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[color-mix(in_srgb,#34a853_85%,var(--foreground))]" />
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-bold uppercase tracking-wide">
                    Payment ops watch
                  </h2>
                  <div className="mt-2 grid gap-2 text-sm text-[var(--muted)] lg:grid-cols-5">
                    <p>
                      <Link
                        className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                        href="/admin/merch?order_status=pending_checkout"
                      >
                        Stale pending Merch checkouts over 24h
                      </Link>
                      :{" "}
                      <span className="font-bold text-[var(--foreground)]">
                        {stalePendingCheckoutCount ?? 0}
                      </span>
                    </p>
                    <div>
                      <p>
                        <Link
                          className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                          href={bookingFilterHref("checkout_started", 1, activeSearch)}
                        >
                          Stale booking deposit checkouts over 24h
                        </Link>
                        :{" "}
                        <span className="font-bold text-[var(--foreground)]">
                          {staleBookingCheckoutCount ?? 0}
                        </span>
                      </p>
                      {profile.role === "admin" || profile.role === "owner" ? (
                        <form action={resetStaleBookingDepositCheckouts} className="mt-2">
                          <input name="confirm" type="hidden" value="reset" />
                          <input
                            name="return_to"
                            type="hidden"
                            value="/admin/payments"
                          />
                          <button
                            className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)]"
                            type="submit"
                          >
                            Reset stale booking checkouts
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p>
                      <Link
                        className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                        href="/admin/ads?payment_status=problem"
                      >
                        Active ads with unpaid/problem payment
                      </Link>
                      :{" "}
                      <span className="font-bold text-[var(--foreground)]">
                        {activeUnpaidAdCount ?? 0}
                      </span>
                    </p>
                    <p>
                      <Link
                        className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                        href={auditFilterHref("payment_disputes", 1, activeSearch)}
                      >
                        Dispute audit entries need review
                      </Link>
                      :{" "}
                      <span className="font-bold text-[var(--foreground)]">
                        {paymentDisputeAuditCount ?? 0}
                      </span>
                    </p>
                    <p>
                      <Link
                        className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                        href={auditFilterHref(
                          "booking_refund_review_requested",
                          1,
                          activeSearch,
                        )}
                      >
                        Booking refund reviews need admin review
                      </Link>
                      :{" "}
                      <span className="font-bold text-[var(--foreground)]">
                        {bookingRefundReviewCount ?? 0}
                      </span>
                    </p>
                    <p>
                      <Link
                        className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                        href={auditFilterHref(
                          "merch_refund_review_requested",
                          1,
                          activeSearch,
                        )}
                      >
                        Merch refund reviews need admin review
                      </Link>
                      :{" "}
                      <span className="font-bold text-[var(--foreground)]">
                        {merchRefundReviewCount ?? 0}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-lg font-bold">Recent payment events</h2>
                  <div className="text-sm text-[var(--muted-strong)] sm:text-right">
                    <p>
                      Showing {rangeStart}-{rangeEnd} of {totalStripeEvents}
                    </p>
                    <p className="text-xs font-semibold">
                      {paymentEventTypeFilter
                        ? eventTypeLabel(paymentEventTypeFilter)
                        : "All event types"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <Link
                    className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                      paymentEventTypeFilter
                        ? "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                        : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    }`}
                    href={paymentEventFilterHref(null, 1, activeSearch)}
                  >
                    All
                  </Link>
                  {paymentEventTypes.map((eventType) => (
                    <Link
                      className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                        paymentEventTypeFilter === eventType
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                      }`}
                      href={paymentEventFilterHref(eventType, 1, activeSearch)}
                      key={eventType}
                    >
                      {eventTypeLabel(eventType)}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {stripeEvents?.length ? (
                    stripeEvents.map((event) => (
                      <article
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                        key={event.event_id}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p className="break-all text-sm font-bold">
                            {event.event_type}
                          </p>
                          <p className="shrink-0 text-xs text-[var(--muted-strong)]">
                            {formatDateTime(event.received_at)}
                          </p>
                        </div>
                        <p className="mt-1 break-all text-xs text-[var(--muted-strong)]">
                          {event.event_id}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-[var(--card-rim)] p-4 text-sm text-[var(--muted)]">
                      No payment events have been recorded yet.
                    </p>
                  )}
                </div>
                <Pagination
                  currentPage={currentPage}
                  hasNextPage={hasNextPage}
                  hrefForPage={(page) =>
                    paymentEventFilterHref(paymentEventTypeFilter, page, activeSearch)
                  }
                  totalPages={totalPages}
                />
              </section>

              <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5 lg:col-start-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Payment audit</h2>
                    <p className="text-sm text-[var(--muted-strong)]">
                      Showing {auditRangeStart}-{auditRangeEnd} of{" "}
                      {totalPaymentAudits}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-[var(--muted-strong)]">
                    {paymentAuditTypeFilter
                      ? auditLabel(paymentAuditTypeFilter)
                      : "Refunds and payment ops"}
                  </p>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <Link
                    className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                      paymentAuditTypeFilter
                        ? "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                        : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    }`}
                    href={auditFilterHref(null, 1, activeSearch)}
                  >
                    All
                  </Link>
                  {paymentAuditTypes.map((auditType) => (
                    <Link
                      className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                        paymentAuditTypeFilter === auditType
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                      }`}
                      href={auditFilterHref(auditType, 1, activeSearch)}
                      key={auditType}
                    >
                      {auditLabel(auditType)}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {paymentAuditLogs?.length ? (
                    paymentAuditLogs.map((audit) => (
                      <article
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                        key={audit.id}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold">
                              {auditLabel(audit.event_type)}
                            </p>
                            {audit.summary ? (
                              <p className="mt-1 break-words text-xs text-[var(--muted)]">
                                {audit.summary}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-xs text-[var(--muted-strong)]">
                            {formatDateTime(audit.created_at)}
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted-strong)]">
                          Actor:{" "}
                          {audit.profiles?.display_name ??
                            audit.profiles?.username ??
                            "System"}
                        </p>
                        {audit.target_type || audit.target_id ? (
                          <p className="mt-1 break-all text-xs text-[var(--muted-strong)]">
                            Target: {audit.target_type ?? "item"}{" "}
                            {audit.target_id ?? ""}
                          </p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-[var(--card-rim)] p-4 text-sm text-[var(--muted)]">
                      No payment audit entries have been recorded yet.
                    </p>
                  )}
                </div>
                <Pagination
                  currentPage={auditCurrentPage}
                  hasNextPage={auditHasNextPage}
                  hrefForPage={(page) =>
                    auditFilterHref(paymentAuditTypeFilter, page, activeSearch)
                  }
                  totalPages={auditTotalPages}
                />
              </section>

              <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Booking deposits</h2>
                      <p className="text-xs font-semibold text-[var(--muted)]">
                        Showing {bookingRangeStart}-{bookingRangeEnd} of{" "}
                        {totalBookingDeposits}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-[var(--muted-strong)]">
                      {bookingPaymentStatusFilter
                        ? bookingPaymentStatusLabel(bookingPaymentStatusFilter)
                        : "All states"}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    <Link
                      className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                        bookingPaymentStatusFilter
                          ? "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                          : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      }`}
                      href={bookingFilterHref(null, 1, activeSearch)}
                    >
                      All
                    </Link>
                    {bookingPaymentStatuses.map((status) => (
                      <Link
                        className={`shrink-0 rounded-md border px-3 py-2 text-xs font-bold ${
                          bookingPaymentStatusFilter === status
                            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                            : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                        }`}
                        href={bookingFilterHref(status, 1, activeSearch)}
                        key={status}
                      >
                        {bookingPaymentStatusLabel(status)}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {recentBookingDeposits?.length ? (
                      recentBookingDeposits.map((booking) => (
                        <article
                          className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm"
                          key={booking.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-bold">{booking.title}</p>
                              <p className="mt-1 text-xs text-[var(--muted-strong)]">
                                {bookingPaymentStatusLabel(booking.payment_status)} -{" "}
                                {statusLabel(booking.status)}
                              </p>
                            </div>
                            <p className="shrink-0 text-right text-xs font-bold text-[var(--foreground)]">
                              {money(booking.total_cents, booking.currency)}
                            </p>
                          </div>
                          <dl className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                            <div className="flex justify-between gap-2">
                              <dt>Client</dt>
                              <dd className="text-right">
                                {booking.client?.username ? (
                                  <Link
                                    className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                                    href={`/u/${booking.client.username}`}
                                  >
                                    {booking.client.display_name ??
                                      booking.client.username}
                                  </Link>
                                ) : (
                                  "Unknown"
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Artist/studio</dt>
                              <dd className="text-right">
                                {booking.artist?.username ? (
                                  <Link
                                    className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                                    href={`/u/${booking.artist.username}`}
                                  >
                                    {booking.artist.display_name ??
                                      booking.artist.username}
                                  </Link>
                                ) : (
                                  "Unknown"
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Deposit</dt>
                              <dd>
                                {money(booking.deposit_amount_cents, booking.currency)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>TTC fee</dt>
                              <dd>
                                {money(booking.platform_fee_cents, booking.currency)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Updated</dt>
                              <dd>{formatDateTime(booking.updated_at)}</dd>
                            </div>
                          </dl>
                          {booking.payment_status === "paid" &&
                          booking.status === "deposit_paid" &&
                          booking.stripe_payment_intent_id ? (
                            <form
                              action={refundBookingDeposit}
                              className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--gold)_34%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_8%,var(--paper-warm))] p-2"
                            >
                              <input
                                name="booking_id"
                                type="hidden"
                                value={booking.id}
                              />
                              <input
                                name="return_to"
                                type="hidden"
                                value="/admin/payments"
                              />
                              <label className="block text-xs font-bold text-[var(--muted-strong)]">
                                Type refund to send full refund
                              </label>
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                  className="min-h-10 flex-1 rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] px-3 text-sm text-[var(--foreground)]"
                                  name="confirm"
                                  placeholder="refund"
                                  type="text"
                                />
                                <button
                                  className="min-h-10 rounded-md border border-[var(--foreground)] bg-[var(--foreground)] px-3 text-sm font-bold text-[var(--background)]"
                                  type="submit"
                                >
                                  Refund
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No booking deposits found.
                      </p>
                    )}
                  </div>
                  <Pagination
                    currentPage={bookingCurrentPage}
                    hasNextPage={bookingHasNextPage}
                    hrefForPage={(nextPage) =>
                      bookingFilterHref(
                        bookingPaymentStatusFilter,
                        nextPage,
                        activeSearch,
                      )
                    }
                    totalPages={bookingTotalPages}
                  />
                </section>

                <section className="ttc-card rounded-lg border border-[color-mix(in_srgb,var(--gold)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--paper-warm))] p-5">
                  <ShieldAlert className="size-5 text-[var(--gold)]" />
                  <h2 className="mt-3 text-lg font-bold">
                    Production payment gates
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Checkout is limited during launch. Keep real commerce
                    gated until these items are handled.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                    {productionPaymentGates.map((gate) => (
                      <li
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-2"
                        key={gate}
                      >
                        {gate}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <h2 className="text-lg font-bold">Merch order states</h2>
                  <div className="mt-3 space-y-2">
                    {merchStatusCounts.length ? (
                      merchStatusCounts.map(([status, count]) => (
                        <Link
                          className="flex items-center justify-between rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm"
                          href={`/admin/merch?order_status=${status}`}
                          key={status}
                        >
                          <span className="font-semibold capitalize">
                            {statusLabel(status)}
                          </span>
                          <span className="text-[var(--muted-strong)]">
                            {count}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No Merch orders found.
                      </p>
                    )}
                  </div>
                </section>

                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <h2 className="text-lg font-bold">Ad payment states</h2>
                  <div className="mt-3 space-y-2">
                    {adStatusCounts.length ? (
                      adStatusCounts.map(([status, count]) => (
                        <Link
                          className="flex items-center justify-between rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm"
                          href={`/admin/ads?payment_status=${status}`}
                          key={status}
                        >
                          <span className="font-semibold capitalize">
                            {statusLabel(status)}
                          </span>
                          <span className="text-[var(--muted-strong)]">
                            {count}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No ad payment states found.
                      </p>
                    )}
                  </div>
                </section>

                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <h2 className="text-lg font-bold">Booking deposit states</h2>
                  <div className="mt-3 space-y-2">
                    {bookingPaymentStatusCounts.length ? (
                      bookingPaymentStatusCounts.map(([status, count]) => (
                        <Link
                          className="flex items-center justify-between rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm"
                          href={bookingFilterHref(status, 1, activeSearch)}
                          key={status}
                        >
                          <span className="font-semibold capitalize">
                            {bookingPaymentStatusLabel(status)}
                          </span>
                          <span className="text-[var(--muted-strong)]">
                            {count}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No booking deposit states found.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
