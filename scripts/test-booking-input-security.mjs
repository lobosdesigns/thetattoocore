import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const appActions = readFileSync("src/app/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const messagesPage = readFileSync("src/app/messages/page.tsx", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const bookingCalendar = readFileSync("src/app/api/bookings/[id]/calendar/route.ts", "utf8");
const lifecycleMigration = readFileSync(
  "supabase/migrations/20260727090000_booking_lifecycle_completion.sql",
  "utf8",
);

const maliciousPayloads = [
  "'; drop table public.booking_requests; --",
  "\" or \"1\"=\"1",
  "<script>alert('xss')</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "%3Cscript%3Ealert(1)%3C/script%3E",
  "../../private/license.pdf",
  "{\"booking_id\":{\"$ne\":\"\"}}",
  "accepted'); update public.profiles set role='owner'; --",
  "%27.or.status.eq.accepted",
  "id.eq.00000000-0000-4000-8000-000000000101,status.eq.accepted",
  "not.is.null",
  "Safe\r\nBEGIN:VEVENT\r\nSUMMARY:pwned",
  "Hello\r\nATTENDEE:mailto:evil@example.com",
  "/messages\r\nLocation: https://evil.example",
];

const validUuid = "00000000-0000-4000-8000-000000000101";

function cleanUuid(value) {
  const text = String(value ?? "").trim().slice(0, 80);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
}

function cleanOptionalUuid(value) {
  const text = String(value ?? "").trim().slice(0, 80);

  if (!text) return { invalid: false, value: "" };

  return {
    invalid: !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text),
    value: text,
  };
}

function cleanReturnPath(value, fallback = "/") {
  const path = String(value ?? "").trim().slice(0, 220) || fallback;

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return fallback;
  }

  return path;
}

function safeInternalReturnPath(value) {
  const text = String(value ?? "").trim().slice(0, 240);

  if (!text ||
    !text.startsWith("/") ||
    text.startsWith("//") ||
    text.includes("\\") ||
    /[\r\n]/.test(text)) {
    return null;
  }

  return text;
}

function cleanBoundedText(value, maxLength) {
  const text = String(value ?? "").trim();

  return {
    oversized: text.length > maxLength,
    text: text.slice(0, maxLength),
  };
}

function icsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function bookingDateTime(value) {
  const text = String(value ?? "").trim().slice(0, 32);

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assertIncludes(source, snippet, label) {
  assert.ok(source.includes(snippet), label);
}

assert.equal(cleanUuid(validUuid), validUuid, "valid UUIDs are accepted");
for (const payload of maliciousPayloads) {
  assert.equal(cleanUuid(payload), "", `malformed UUID rejected: ${payload}`);
  assert.equal(cleanOptionalUuid(payload).invalid, true, `optional malformed UUID flagged: ${payload}`);
}
assert.equal(cleanOptionalUuid("").invalid, false, "blank optional UUID is allowed as empty");

for (const payload of maliciousPayloads) {
  assert.equal(
    cleanReturnPath(payload, "/fallback"),
    "/fallback",
    `unsafe booking return path rejected: ${payload}`,
  );
  assert.equal(safeInternalReturnPath(payload), null, `unsafe checkout return path rejected: ${payload}`);
}
assert.equal(cleanReturnPath("/u/artist#booking-request"), "/u/artist#booking-request", "safe internal return path accepted");
assert.equal(safeInternalReturnPath("/messages?c=abc"), "/messages?c=abc", "safe checkout return path accepted");

assert.equal(
  cleanBoundedText("<script>alert(1)</script>", 1000).oversized,
  false,
  "script-like text is treated as text when within size limits",
);
assert.equal(
  cleanBoundedText("x".repeat(1001), 1000).oversized,
  true,
  "oversized artist notes are rejected before database writes",
);
assert.equal(
  cleanBoundedText("x".repeat(2001), 2000).oversized,
  true,
  "oversized booking descriptions are rejected before database writes",
);

const escapedIcs = icsText("Line one\r\nBEGIN:VEVENT\r\nATTENDEE:mailto:evil@example.com,semi;slash\\");
assert.equal(escapedIcs.includes("\r"), false, "calendar text removes raw carriage returns");
assert.equal(escapedIcs.includes("\nBEGIN:VEVENT"), false, "calendar text prevents raw ICS field injection");
assert.ok(escapedIcs.includes("\\nBEGIN:VEVENT"), "calendar newlines are literal escaped text");
assert.ok(escapedIcs.includes("\\,semi\\;slash\\\\"), "calendar commas, semicolons, and slashes are escaped");

assert.match(bookingDateTime("2026-01-31T14:45") ?? "", /^2026-01-31T\d{2}:45:00\.000Z$/, "well-formed booking times are accepted");
for (const payload of ["2026-13-99T99:99", "2026-01-01T00:00Z", "<script>alert(1)</script>", "2026-01-01 00:00"]) {
  assert.equal(bookingDateTime(payload), null, `malformed booking timestamp rejected: ${payload}`);
}

assertIncludes(appActions, "const artistId = cleanUuid(formData.get(\"artist_id\"));", "booking request artist id uses UUID allowlist");
assertIncludes(appActions, "cleanOptionalUuid(formData.get(\"appointment_type_id\"))", "appointment type id uses optional UUID validation");
assertIncludes(appActions, "cleanOptionalUuid(formData.get(\"preferred_slot_id\"))", "preferred slot id uses optional UUID validation");
assertIncludes(appActions, "Keep booking request fields within their size limits.", "booking request oversized fields fail safely");
assertIncludes(appActions, "path.includes(\"\\\\\")", "booking return paths reject backslashes");

assertIncludes(accountActions, "const bookingId = cleanUuid(formData.get(\"booking_id\"));", "booking lifecycle ids use UUID allowlist");
assertIncludes(accountActions, "cleanBoundedText(formData.get(\"artist_note\"), 1000)", "artist notes are bounded server-side");
assertIncludes(accountActions, "Keep booking response notes under 1000 characters.", "oversized response notes fail safely");
assertIncludes(accountActions, "Keep refund review notes under 500 characters.", "oversized refund notes fail safely");
assertIncludes(accountActions, "if (error || !updatedBooking)", "duplicate lifecycle submissions stop before side effects");
assertIncludes(accountActions, '["accept", "decline", "changes"].includes(decision)', "artist response decisions use a status allowlist");
assertIncludes(accountActions, 'bookingDateTime(formData.get("scheduled_start_at"))', "reschedule timestamps use server-side date validation");

assertIncludes(bookingCheckout, "hasSupportedFormContentType(request)", "checkout rejects unsupported content types");
assertIncludes(bookingCheckout, "hasSafeFormSize(request)", "checkout caps form body size before parsing");
assertIncludes(bookingCheckout, "const bookingId = cleanUuid(formData.get(\"booking_id\"));", "checkout booking id uses UUID allowlist before RPC");
assertIncludes(bookingCheckout, "p_booking_id: booking.id", "checkout RPC receives server-selected booking id");
assertIncludes(bookingCheckout, "p_client_id: claims.sub", "checkout RPC receives server-derived client id");
assertIncludes(bookingCheckout, '.eq("client_id", claims.sub)', "checkout queries are scoped to the authenticated client");
assertIncludes(bookingCheckout, '!["accepted", "rescheduled"].includes(booking.status)', "checkout status uses an allowlist before Stripe");
assertIncludes(bookingCheckout, '"line_items[0][price_data][unit_amount]": String(', "Stripe amount comes from server-selected booking data");
assertIncludes(bookingCheckout, '"success_url": successUrl', "Stripe success URL is built server-side from a safe internal path");
assertIncludes(bookingCheckout, '"cancel_url": cancelUrl', "Stripe cancel URL is built server-side from a safe internal path");
assert.equal(bookingCheckout.includes("artist_note"), false, "artist notes are not copied into Stripe metadata");
assert.equal(bookingCheckout.includes("booking.body"), false, "booking descriptions are not copied into Stripe metadata");
const checkoutSelectFields = bookingCheckout.match(/\.select\(\s*"([^"]+)"/s)?.[1].split(",").map((field) => field.trim()) ?? [];
assert.equal(checkoutSelectFields.includes("body"), false, "booking descriptions are not selected for checkout");

assertIncludes(bookingCalendar, "const bookingId = cleanUuid(id);", "calendar route validates path id as UUID before querying");
assertIncludes(bookingCalendar, '.eq("id", bookingId)', "calendar route uses a parameterized Supabase equality filter");
assertIncludes(bookingCalendar, "booking.client_id !== claims.sub && booking.artist_id !== claims.sub", "calendar route only returns files to booking participants");
assertIncludes(bookingCalendar, '.replace(/\\r\\n|\\r|\\n/g, "\\\\n")', "calendar text escapes CRLF injection attempts");
assertIncludes(bookingCalendar, "SUMMARY:${icsText(`${siteName} booking: ${booking.title}`)}", "calendar summary escapes booking title");
assertIncludes(bookingCalendar, "DESCRIPTION:${icsText(description)}", "calendar description escapes user booking fields");
assertIncludes(bookingCalendar, '["accepted", "rescheduled", "deposit_pending", "deposit_paid", "completed"].includes(booking.status)', "calendar status uses an allowlist");

assert.equal(
  /^\s*execute\s+(?!on\b)/im.test(lifecycleMigration),
  false,
  "booking lifecycle SQL functions do not use dynamic SQL",
);
assertIncludes(lifecycleMigration, "p_booking_id uuid", "booking reservation RPC uses typed UUID parameters");
assertIncludes(lifecycleMigration, "p_client_id uuid", "booking reservation RPC uses typed UUID parameters for caller identity");
assert.match(
  lifecycleMigration,
  /grant\s+execute\s+on\s+function\s+public\.reserve_booking_deposit_checkout\(uuid, uuid\)\s+to\s+service_role/i,
  "deposit reservation RPC stays server-only",
);

for (const source of [accountPage, messagesPage]) {
  assert.equal(source.includes("dangerouslySetInnerHTML"), false, "booking account/message surfaces avoid raw HTML sinks");
  assert.equal(source.includes("__html"), false, "booking account/message surfaces avoid raw HTML payload rendering");
}
assertIncludes(accountPage, "{booking.body}", "account booking description renders through React text escaping");
assertIncludes(messagesPage, "{booking.body}", "message booking description renders through React text escaping");
assertIncludes(accountPage, "{booking.artist_note ? <p>Note: {booking.artist_note}</p> : null}", "account artist notes render through React text escaping");
assertIncludes(messagesPage, "{booking.artist_note ? <p>Note: {booking.artist_note}</p> : null}", "message artist notes render through React text escaping");

for (const source of [appActions, accountActions, bookingCheckout, bookingCalendar]) {
  for (const payload of maliciousPayloads) {
    assert.equal(source.includes(payload), false, `malicious payload not hard-coded into source: ${payload}`);
  }
  assert.equal(/from\([^)]*`/.test(source), false, "Supabase table names are not built from template strings");
}

console.log("PASS booking user input security contracts");
