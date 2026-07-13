import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260713015711_booking_request_foundation.sql",
  "utf8",
);
const shopIndexMigration = readFileSync(
  "supabase/migrations/20260713020644_booking_shop_profile_index.sql",
  "utf8",
);
const bookingSettingsMigration = readFileSync(
  "supabase/migrations/20260713093653_booking_settings_foundation.sql",
  "utf8",
);
const bookingCancellationMigration = readFileSync(
  "supabase/migrations/20260713100043_booking_cancellation_notifications.sql",
  "utf8",
);
const bookingPolicyMigration = readFileSync(
  "supabase/migrations/20260713100845_booking_cancellation_policy.sql",
  "utf8",
);
const bookingCalendarMigration = readFileSync(
  "supabase/migrations/20260713182530_booking_calendar_public_fields.sql",
  "utf8",
);
const bookingScheduledMigration = readFileSync(
  "supabase/migrations/20260713192618_booking_scheduled_calendar_fields.sql",
  "utf8",
);
const actions = readFileSync("src/app/actions.ts", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const bookingCalendarRoute = readFileSync(
  "src/app/api/bookings/[id]/calendar/route.ts",
  "utf8",
);
const messagesPage = readFileSync("src/app/messages/page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const notificationsPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const fees = readFileSync("src/lib/payments/fees.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");

const checks = [
  {
    label: "booking migration creates RLS-protected booking requests",
    ok:
      migration.includes("create table if not exists public.booking_requests") &&
      migration.includes("alter table public.booking_requests enable row level security") &&
      migration.includes('create policy "Booking participants can read requests"') &&
      migration.includes('create policy "Members can request verified booking recipients"') &&
      migration.includes('create policy "Moderators can update booking requests"'),
  },
  {
    label: "booking requests require verified artist or studio recipients",
    ok:
      migration.includes("artist.account_type in ('artist', 'studio')") &&
      migration.includes("artist.license_verified_at is not null") &&
      migration.includes("artist.suspended_at is null") &&
      migration.includes("artist.banned_at is null") &&
      migration.includes("artist.shop_profile_id = shop_profile_id"),
  },
  {
    label: "booking shop profile foreign key has a covering index",
    ok:
      shopIndexMigration.includes("booking_requests_shop_profile_created_idx") &&
      shopIndexMigration.includes("on public.booking_requests (shop_profile_id, created_at desc)") &&
      shopIndexMigration.includes("where shop_profile_id is not null"),
  },
  {
    label: "booking settings migration creates RLS-protected manual availability",
    ok:
      bookingSettingsMigration.includes("create table if not exists public.booking_settings") &&
      bookingPolicyMigration.includes("add column if not exists cancellation_policy text") &&
      bookingPolicyMigration.includes("booking_settings_cancellation_policy_check") &&
      bookingSettingsMigration.includes("alter table public.booking_settings enable row level security") &&
      bookingSettingsMigration.includes('create policy "Public can read enabled verified booking settings"') &&
      bookingSettingsMigration.includes('create policy "Verified artists manage own booking settings"') &&
      bookingSettingsMigration.includes("weekly_availability jsonb not null default '{}'::jsonb") &&
      bookingSettingsMigration.includes("calendar_connection_status in ('manual', 'google_planned', 'apple_ical_planned', 'connected')"),
  },
  {
    label: "booking money fields record deposit plus TTC fee",
    ok:
      migration.includes("deposit_amount_cents integer not null default 0") &&
      migration.includes("platform_fee_cents integer not null default 0") &&
      migration.includes("total_cents = deposit_amount_cents + platform_fee_cents") &&
      fees.includes('export type PlatformFeeKind = "ad" | "booking" | "merch"') &&
      fees.includes("booking deposit processing"),
  },
  {
    label: "booking notifications are accepted by database and UI",
    ok:
      migration.includes("'booking_request'") &&
      migration.includes("'booking_accepted'") &&
      migration.includes("'booking_declined'") &&
      migration.includes("'booking_deposit_paid'") &&
      bookingCancellationMigration.includes("'booking_cancelled'") &&
      notificationsPage.includes('"booking_request"') &&
      notificationsPage.includes('"booking_cancelled"') &&
      notificationsPage.includes("CalendarDays") &&
      notificationsPage.includes('return "Booking"'),
  },
  {
    label: "profile booking request form only posts through server action",
    ok:
      profilePage.includes("createBookingRequest") &&
      profilePage.includes("canRequestBooking") &&
      profilePage.includes('id="booking-request"') &&
      profilePage.includes("Deposit checkout opens only after") &&
      profilePage.includes("platformFeePercentLabel"),
  },
  {
    label: "booking server action checks recipient and records notification",
    ok:
      actions.includes("export async function createBookingRequest") &&
      actions.includes("await requireProfile()") &&
      actions.includes("calculatePlatformFeeCents(depositAmountCents)") &&
      actions.includes("ensureDirectConversation") &&
      actions.includes("conversation_id: conversationId") &&
      actions.includes('.from("booking_requests")') &&
      actions.includes('type: "booking_request"') &&
      actions.includes('href: `/messages?c=${conversationId}`') &&
      actions.includes("Deposit checkout opens after they accept."),
  },
  {
    label: "account page exposes booking inbox and artist responses",
    ok:
      accountPage.includes('["#booking-settings", "Bookings"]') &&
      accountPage.includes('.from("booking_requests")') &&
      accountPage.includes("visibleIncomingBookings") &&
      accountPage.includes("visibleOutgoingBookings") &&
      accountPage.includes("respondBookingRequest") &&
      accountPage.includes("deposit checkout will open"),
  },
  {
    label: "account page exposes manual booking availability settings",
    ok:
      accountActions.includes("export async function updateBookingSettings") &&
      accountActions.includes('.from("booking_settings").upsert') &&
      accountActions.includes("Verified artist or studio status is required for booking availability.") &&
      accountPage.includes("updateBookingSettings") &&
      accountPage.includes("Booking availability") &&
      accountPage.includes("Show booking availability") &&
      accountPage.includes("cancellation_policy") &&
      accountPage.includes("calendar_connection_status"),
  },
  {
    label: "artist booking responses are server-only and notify clients",
    ok:
      accountActions.includes("export async function respondBookingRequest") &&
      accountActions.includes("createAdminClient()") &&
      accountActions.includes('.eq("artist_id", claims.sub)') &&
      accountActions.includes('type: decision === "accept" ? "booking_accepted" : "booking_declined"') &&
      accountActions.includes("Deposit checkout is the next booking step."),
  },
  {
    label: "accepted booking requests can carry scheduled appointment times",
    ok:
      bookingScheduledMigration.includes("add column if not exists scheduled_start_at") &&
      bookingScheduledMigration.includes("add column if not exists scheduled_end_at") &&
      bookingScheduledMigration.includes("add column if not exists scheduled_timezone") &&
      bookingScheduledMigration.includes("booking_requests_schedule_check") &&
      bookingScheduledMigration.includes("scheduled_end_at <= scheduled_start_at + interval '12 hours'") &&
      accountActions.includes("bookingDateTime(formData.get(\"scheduled_start_at\"))") &&
      accountActions.includes("scheduled_timezone: scheduledTimezone") &&
      accountPage.includes('name="scheduled_start_at"') &&
      accountPage.includes('name="scheduled_end_at"') &&
      messagesPage.includes('name="scheduled_start_at"') &&
      messagesPage.includes('name="scheduled_end_at"'),
  },
  {
    label: "booking participants can download private calendar files",
    ok:
      bookingCalendarRoute.includes('from("booking_requests")') &&
      bookingCalendarRoute.includes("supabase.auth.getClaims()") &&
      bookingCalendarRoute.includes("text/calendar") &&
      bookingCalendarRoute.includes("DTSTART;TZID=") &&
      bookingCalendarRoute.includes("Cache-Control") &&
      accountPage.includes("/calendar") &&
      messagesPage.includes("/calendar"),
  },
  {
    label: "clients can cancel unpaid booking requests safely",
    ok:
      accountActions.includes("export async function cancelBookingRequest") &&
      accountActions.includes('type: "booking_cancelled"') &&
      accountActions.includes('.in("status", ["requested", "accepted"])') &&
      accountActions.includes('.in("payment_status", ["not_ready", "payment_failed"])') &&
      accountPage.includes("cancelBookingRequest") &&
      accountPage.includes("Cancel request") &&
      messagesPage.includes("cancelBookingRequest") &&
      messagesPage.includes("canCancel"),
  },
  {
    label: "accepted booking deposits use guarded Stripe checkout",
    ok:
      accountPage.includes('action="/api/bookings/checkout"') &&
      accountPage.includes("Pay deposit") &&
      bookingCheckout.includes("export async function POST") &&
      bookingCheckout.includes('metadata[payment_kind]": "booking_deposit"') &&
      bookingCheckout.includes("platformFeeDescription(\"booking\")") &&
      bookingCheckout.includes('.eq("client_id", claims.sub)') &&
      bookingCheckout.includes('status: "deposit_pending"') &&
      bookingCheckout.includes('payment_status: "checkout_started"'),
  },
  {
    label: "DM threads surface attached booking requests",
    ok:
      messagesPage.includes("type BookingRequest") &&
      messagesPage.includes("function BookingCards") &&
      messagesPage.includes('.from("booking_requests")') &&
      messagesPage.includes('.eq("conversation_id", selectedConversation.id)') &&
      messagesPage.includes("respondBookingRequest") &&
      messagesPage.includes('action="/api/bookings/checkout"'),
  },
  {
    label: "public profiles show enabled booking availability",
    ok:
      profilePage.includes("type BookingSettings") &&
      profilePage.includes('.from("booking_settings")') &&
      profilePage.includes("canShowBookingAvailability") &&
      profilePage.includes("Open for requests") &&
      profilePage.includes("Cancellation policy") &&
      profilePage.includes("default_deposit_amount_cents"),
  },
  {
    label: "booking settings support safe public calendar prep fields",
    ok:
      bookingCalendarMigration.includes("add column if not exists booking_url text") &&
      bookingCalendarMigration.includes("add column if not exists calendar_notes text") &&
      bookingCalendarMigration.includes("booking_settings_booking_url_check") &&
      bookingCalendarMigration.includes("booking_url ~ '^https?://'") &&
      accountActions.includes("const bookingUrl = cleanExternalUrl(formData.get(\"booking_url\"), 500)") &&
      accountActions.includes("calendar_notes: calendarNotes || null") &&
      accountPage.includes("Public booking link") &&
      accountPage.includes("Calendar notes") &&
      profilePage.includes("Open booking link") &&
      profilePage.includes("bookingSettings.calendar_notes"),
  },
  {
    label: "Stripe webhook understands booking deposit events",
    ok:
      stripeWebhook.includes("markBookingCheckoutSession") &&
      stripeWebhook.includes('payment_kind === "booking_deposit"') &&
      stripeWebhook.includes('type: "booking_deposit_paid"') &&
      stripeWebhook.includes('status: status === "paid" ? "deposit_paid" : "accepted"') &&
      stripeWebhook.includes('payment_status: status === "cancelled" ? "payment_failed" : status'),
  },
  {
    label: "plan records calendars, deposits, fees, and next booking steps",
    ok:
      productPlan.includes("Google Calendar, Apple/iCloud Calendar, or standard iCalendar") &&
      productPlan.includes("booking_requests") &&
      productPlan.includes("transparent TTC processing fee") &&
      productPlan.includes("Stripe Checkout for accepted deposits only") &&
      productPlan.includes("cancellation policy"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} booking guard smoke check(s) failed.`);
  process.exit(1);
}
