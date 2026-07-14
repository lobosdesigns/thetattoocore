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
const bookingSlotMigration = readFileSync(
  "supabase/migrations/20260714154123_booking_slot_foundation.sql",
  "utf8",
);
const bookingRequestSlotMigration = readFileSync(
  "supabase/migrations/20260714161754_booking_request_slot_references.sql",
  "utf8",
);
const bookingRequestChoiceMigration = readFileSync(
  "supabase/migrations/20260714162718_booking_request_choice_snapshots.sql",
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
const statusLabels = readFileSync("src/lib/status-labels.ts", "utf8");
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
      profilePage.includes('name="appointment_type_id"') &&
      profilePage.includes('name="preferred_slot_id"') &&
      profilePage.includes("Deposit checkout opens only after") &&
      profilePage.includes("platformFeePercentLabel"),
  },
  {
    label: "booking server action checks recipient and records notification",
    ok:
      actions.includes("export async function createBookingRequest") &&
      actions.includes("await requireProfile()") &&
      actions.includes("calculatePlatformFeeCents(depositAmountCents)") &&
      actions.includes('.from("booking_settings")') &&
      actions.includes("bookingSettings?.booking_enabled") &&
      actions.includes("not accepting booking requests right now") &&
      actions.includes("minimumDepositAmountCents") &&
      actions.includes("bookingSettings.deposit_policy === \"required\"") &&
      actions.includes("appointmentType.deposit_policy === \"required\"") &&
      actions.includes("depositAmountCents = Math.max(depositAmountCents, minimumDepositAmountCents)") &&
      actions.includes('formData.get("appointment_type_id")') &&
      actions.includes('formData.get("preferred_slot_id")') &&
      actions.includes('.from("booking_appointment_types")') &&
      actions.includes('.from("booking_availability_slots")') &&
      actions.includes("ensureDirectConversation") &&
      actions.includes("conversation_id: conversationId") &&
      actions.includes("appointment_type_id: appointmentTypeId || null") &&
      actions.includes("preferred_slot_id: preferredSlotId || null") &&
      actions.includes("appointment_type_label: appointmentTypeName") &&
      actions.includes("preferred_slot_label: preferredSlotLabel") &&
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
      accountPage.includes("appointment_type_label") &&
      accountPage.includes("preferred_slot_label") &&
      accountPage.includes("respondBookingRequest") &&
      accountPage.includes("deposit checkout will open"),
  },
  {
    label: "account page exposes manual booking availability settings",
    ok:
      accountActions.includes("export async function updateBookingSettings") &&
      accountActions.includes('.from("booking_settings").upsert') &&
      accountActions.includes("Verified artist or studio status is required for booking availability.") &&
      accountActions.includes("depositPolicy === \"required\" && defaultDepositAmountCents <= 0") &&
      accountActions.includes("Required deposit settings need a default deposit amount.") &&
      accountPage.includes("updateBookingSettings") &&
      accountPage.includes("Booking availability") &&
      accountPage.includes("Show booking availability") &&
      accountPage.includes("clients") &&
      accountPage.includes("see the expected deposit") &&
      accountPage.includes("cancellation_policy") &&
      accountPage.includes("calendar_connection_status"),
  },
  {
    label: "account page exposes TimeTix-style appointment type controls",
    ok:
      accountActions.includes("export async function createBookingAppointmentType") &&
      accountActions.includes("export async function toggleBookingAppointmentType") &&
      accountActions.includes("export async function deleteBookingAppointmentType") &&
      accountActions.includes('.from("booking_appointment_types")') &&
      accountActions.includes("Could not delete appointment type") &&
      accountActions.includes("duration_minutes: durationMinutes") &&
      accountActions.includes("buffer_before_minutes: bufferBeforeMinutes") &&
      accountActions.includes("buffer_after_minutes: bufferAfterMinutes") &&
      accountActions.includes("deposit_amount_cents: depositAmountCents") &&
      accountPage.includes("createBookingAppointmentType") &&
      accountPage.includes("toggleBookingAppointmentType") &&
      accountPage.includes("deleteBookingAppointmentType") &&
      accountPage.includes("Appointment types") &&
      accountPage.includes("Minutes") &&
      accountPage.includes("Buffer after") &&
      accountPage.includes("Deposit amount") &&
      accountPage.includes("Delete"),
  },
  {
    label: "account page exposes weekly booking slot template controls",
    ok:
      accountActions.includes("export async function createBookingSlot") &&
      accountActions.includes("export async function deleteBookingSlot") &&
      accountActions.includes('.from("booking_availability_slots")') &&
      accountActions.includes("slot_interval_minutes: slotIntervalMinutes") &&
      accountActions.includes("max_bookings_per_slot: maxBookingsPerSlot") &&
      accountActions.includes("startsAt >= endsAt") &&
      accountPage.includes("createBookingSlot") &&
      accountPage.includes("deleteBookingSlot") &&
      accountPage.includes("Weekly slot templates") &&
      accountPage.includes("Interval") &&
      accountPage.includes("Capacity") &&
      accountPage.includes("Add slot template"),
  },
  {
    label: "account page exposes booking blackout date controls",
    ok:
      accountActions.includes("export async function createBookingBlackoutDate") &&
      accountActions.includes("export async function deleteBookingBlackoutDate") &&
      accountActions.includes('.from("booking_blackout_dates")') &&
      accountActions.includes("Blackout end time must be after the start time.") &&
      accountPage.includes("createBookingBlackoutDate") &&
      accountPage.includes("deleteBookingBlackoutDate") &&
      accountPage.includes("Blackout dates") &&
      accountPage.includes("All day") &&
      accountPage.includes("Add blackout"),
  },
  {
    label: "artist booking responses are server-only and notify clients",
    ok:
      accountActions.includes("export async function respondBookingRequest") &&
      accountActions.includes("createAdminClient()") &&
      accountActions.includes('.eq("artist_id", claims.sub)') &&
      accountActions.includes('.from("booking_blackout_dates")') &&
      accountActions.includes("overlaps a blackout window") &&
      accountActions.includes("overlaps another scheduled booking") &&
      accountActions.includes('.in("status", ["accepted", "deposit_pending", "deposit_paid", "completed"])') &&
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
      bookingCalendarRoute.includes("appointment_type_label") &&
      bookingCalendarRoute.includes("preferred_slot_label") &&
      bookingCalendarRoute.includes("Preferred slot:") &&
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
    label: "artists can cancel unpaid accepted booking requests safely",
    ok:
      accountActions.includes("export async function cancelAcceptedBookingAsArtist") &&
      accountActions.includes('.eq("artist_id", claims.sub)') &&
      accountActions.includes('booking.status === "accepted"') &&
      accountActions.includes('["not_ready", "payment_failed"].includes(booking.payment_status)') &&
      accountActions.includes('type: "booking_cancelled"') &&
      accountPage.includes("cancelAcceptedBookingAsArtist") &&
      accountPage.includes("Cancel accepted booking") &&
      messagesPage.includes("cancelAcceptedBookingAsArtist") &&
      messagesPage.includes("canCancelAsArtist"),
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
    label: "booking cards show friendly status labels instead of raw payment states",
    ok:
      accountPage.includes("bookingStatusLabel") &&
      accountPage.includes("bookingPaymentStatusLabel") &&
      !accountPage.includes("booking.payment_status.replace(\"_\", \" \")") &&
      !accountPage.includes("booking.status.replace(\"_\", \" \")") &&
      messagesPage.includes("bookingStatusLabel") &&
      messagesPage.includes("bookingPaymentStatusLabel") &&
      !messagesPage.includes("booking.payment_status.replace(\"_\", \" \")") &&
      !messagesPage.includes("booking.status.replace(\"_\", \" \")") &&
      statusLabels.includes("export function bookingStatusLabel") &&
      statusLabels.includes("export function bookingPaymentStatusLabel") &&
      statusLabels.includes('if (status === "checkout_started") return "Checkout started"') &&
      statusLabels.includes('if (status === "payment_failed") return "Payment failed"'),
  },
  {
    label: "booking calendar connection status uses friendly account labels",
    ok:
      accountPage.includes("calendarConnectionStatusLabel") &&
      !accountPage.includes('calendar_connection_status ?? "manual").replaceAll("_", " ")') &&
      statusLabels.includes("export function calendarConnectionStatusLabel") &&
      statusLabels.includes('if (!status || status === "manual") return "Manual setup"') &&
      statusLabels.includes('if (status === "apple_ical_planned") return "Apple or iCalendar planned"'),
  },
  {
    label: "DM threads surface attached booking requests",
    ok:
      messagesPage.includes("type BookingRequest") &&
      messagesPage.includes("function BookingCards") &&
      messagesPage.includes("returnPath") &&
      messagesPage.includes('name="return_to"') &&
      messagesPage.includes('.from("booking_requests")') &&
      messagesPage.includes('.eq("conversation_id", selectedConversation.id)') &&
      messagesPage.includes("appointment_type_label") &&
      messagesPage.includes("preferred_slot_label") &&
      messagesPage.includes("respondBookingRequest") &&
      messagesPage.includes('action="/api/bookings/checkout"'),
  },
  {
    label: "booking actions can return to DM threads safely",
    ok:
      accountActions.includes("function safeInternalReturnPath") &&
      accountActions.includes("text.startsWith(\"/\")") &&
      accountActions.includes("text.startsWith(\"//\")") &&
      accountActions.includes("function bookingRedirectPath") &&
      accountActions.includes('formData.get("return_to")') &&
      messagesPage.includes('returnPath={`/messages?c=${selectedConversation.id}`}'),
  },
  {
    label: "public profiles show enabled booking availability",
    ok:
      profilePage.includes("type BookingSettings") &&
      profilePage.includes("type PublicBookingAppointmentType") &&
      profilePage.includes("type PublicBookingSlot") &&
      profilePage.includes('.from("booking_settings")') &&
      profilePage.includes('.from("booking_appointment_types")') &&
      profilePage.includes('.from("booking_availability_slots")') &&
      profilePage.includes("canShowBookingAvailability") &&
      profilePage.includes("Open for requests") &&
      profilePage.includes("Appointment types") &&
      profilePage.includes("Weekly slots") &&
      profilePage.includes("visibleBookingAppointmentTypes") &&
      profilePage.includes("visibleBookingSlots") &&
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
      accountPage.includes("Add your public booking page or calendar request link") &&
      accountPage.includes("Use a public booking, calendar, or request page") &&
      profilePage.includes("Open booking link") &&
      profilePage.includes("calendarConnectionStatusLabel") &&
      profilePage.includes("trusted booking or calendar") &&
      profilePage.includes("bookingSettings.calendar_notes"),
  },
  {
    label: "booking slot foundation models appointment types, slots, blackouts, and calendar connections",
    ok:
      bookingSlotMigration.includes("create table if not exists public.booking_appointment_types") &&
      bookingSlotMigration.includes("create table if not exists public.booking_availability_slots") &&
      bookingSlotMigration.includes("create table if not exists public.booking_blackout_dates") &&
      bookingSlotMigration.includes("create table if not exists public.booking_calendar_connections") &&
      bookingSlotMigration.includes("duration_minutes between 10 and 720") &&
      bookingSlotMigration.includes("slot_interval_minutes in (15, 20, 30, 45, 60, 90, 120)") &&
      bookingSlotMigration.includes("provider in ('google', 'apple_ical', 'ical_feed')"),
  },
  {
    label: "booking requests can reference selected appointment types and preferred slots",
    ok:
      bookingRequestSlotMigration.includes("add column if not exists appointment_type_id uuid") &&
      bookingRequestSlotMigration.includes("references public.booking_appointment_types(id) on delete set null") &&
      bookingRequestSlotMigration.includes("add column if not exists preferred_slot_id uuid") &&
      bookingRequestSlotMigration.includes("references public.booking_availability_slots(id) on delete set null") &&
      bookingRequestSlotMigration.includes("booking_requests_appointment_type_created_idx") &&
      bookingRequestSlotMigration.includes("booking_requests_preferred_slot_created_idx") &&
      productPlan.includes("booking request references to selected appointment types or preferred weekly slots"),
  },
  {
    label: "booking requests snapshot selected booking labels for cards",
    ok:
      bookingRequestChoiceMigration.includes("add column if not exists appointment_type_label text") &&
      bookingRequestChoiceMigration.includes("add column if not exists preferred_slot_label text") &&
      bookingRequestChoiceMigration.includes("booking_requests_choice_snapshot_check") &&
      bookingRequestChoiceMigration.includes("char_length(appointment_type_label) <= 120") &&
      bookingRequestChoiceMigration.includes("char_length(preferred_slot_label) <= 120") &&
      accountPage.includes("Type: {booking.appointment_type_label}") &&
      accountPage.includes("Preferred slot: {booking.preferred_slot_label}") &&
      messagesPage.includes("Type: {booking.appointment_type_label}") &&
      messagesPage.includes("Preferred slot: {booking.preferred_slot_label}"),
  },
  {
    label: "booking slot foundation keeps RLS and verified-owner policies",
    ok:
      bookingSlotMigration.includes("alter table public.booking_appointment_types enable row level security") &&
      bookingSlotMigration.includes("alter table public.booking_availability_slots enable row level security") &&
      bookingSlotMigration.includes("alter table public.booking_blackout_dates enable row level security") &&
      bookingSlotMigration.includes("alter table public.booking_calendar_connections enable row level security") &&
      bookingSlotMigration.includes('create policy "Public can read active booking appointment types"') &&
      bookingSlotMigration.includes('create policy "Public can read active booking slots"') &&
      bookingSlotMigration.includes('create policy "Owners manage booking blackout dates"') &&
      bookingSlotMigration.includes('create policy "Owners manage booking calendar connections"') &&
      bookingSlotMigration.includes("profiles.license_verified_at is not null") &&
      bookingSlotMigration.includes("booking_settings.booking_enabled"),
  },
  {
    label: "booking calendar connections avoid storing raw OAuth secrets",
    ok:
      bookingSlotMigration.includes("booking_calendar_connections") &&
      !bookingSlotMigration.includes("access_token") &&
      !bookingSlotMigration.includes("refresh_token") &&
      !bookingSlotMigration.includes("client_secret") &&
      !bookingSlotMigration.includes("oauth_token"),
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
      productPlan.includes("TimeTix-style booking system") &&
      productPlan.includes("appointment types") &&
      productPlan.includes("blackout dates") &&
      productPlan.includes("slot-template tables") &&
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
