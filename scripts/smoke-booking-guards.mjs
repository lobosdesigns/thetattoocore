import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260713015711_booking_request_foundation.sql",
  "utf8",
);
const shopIndexMigration = readFileSync(
  "supabase/migrations/20260713020644_booking_shop_profile_index.sql",
  "utf8",
);
const actions = readFileSync("src/app/actions.ts", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
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
      notificationsPage.includes('"booking_request"') &&
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
      actions.includes('.from("booking_requests")') &&
      actions.includes('type: "booking_request"') &&
      actions.includes("Deposit checkout opens after they accept."),
  },
  {
    label: "plan records calendars, deposits, fees, and next booking steps",
    ok:
      productPlan.includes("Google Calendar, Apple/iCloud Calendar, or standard iCalendar") &&
      productPlan.includes("booking_requests") &&
      productPlan.includes("transparent TTC processing fee") &&
      productPlan.includes("Stripe Checkout for accepted deposits only"),
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
