import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");

const siteUrl = "https://thetattoocore.com";
const defaultBookingReturnPath = "/account#booking-settings";
const signInMessage = "Sign in to pay a booking deposit.";

function safeInternalReturnPath(value) {
  const text = String(value ?? "")
    .trim()
    .slice(0, 240);

  if (!text ||
    !text.startsWith("/") ||
    text.startsWith("//") ||
    text.includes("\\") ||
    /[\r\n]/.test(text)) {
    return null;
  }

  return text;
}

function signedOutBookingCheckoutLocation(value) {
  const returnTo = safeInternalReturnPath(value) ?? defaultBookingReturnPath;

  return `${siteUrl}/login?message=${encodeURIComponent(signInMessage)}&return_to=${encodeURIComponent(returnTo)}`;
}

function normalizedLocation(location, origin = siteUrl) {
  const parsed = new URL(location, origin);

  if (parsed.origin !== origin) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function assertSourceOrder(before, after, label) {
  const beforeIndex = bookingCheckout.indexOf(before);
  const afterIndex = bookingCheckout.indexOf(after);

  assert.notEqual(beforeIndex, -1, `${label}: missing before marker`);
  assert.notEqual(afterIndex, -1, `${label}: missing after marker`);
  assert.ok(beforeIndex < afterIndex, label);
}

const expectedDefaultLocation = signedOutBookingCheckoutLocation(null);
assert.equal(
  expectedDefaultLocation,
  "https://thetattoocore.com/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Faccount%23booking-settings",
  "signed-out checkout redirects to login with the booking deposit message and default return path",
);
assert.equal(
  normalizedLocation(expectedDefaultLocation),
  "/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Faccount%23booking-settings",
  "same-origin absolute locations normalize to the intended login path",
);
assert.equal(
  normalizedLocation("/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Faccount%23booking-settings"),
  "/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Faccount%23booking-settings",
  "relative locations normalize to the intended login path",
);
assert.equal(
  normalizedLocation("https://evil.example/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Faccount%23booking-settings"),
  null,
  "external absolute redirect locations are rejected",
);
assert.equal(
  signedOutBookingCheckoutLocation("/messages?c=abc&booking_status=accepted"),
  "https://thetattoocore.com/login?message=Sign%20in%20to%20pay%20a%20booking%20deposit.&return_to=%2Fmessages%3Fc%3Dabc%26booking_status%3Daccepted",
  "safe internal return paths are encoded as one return_to value",
);

for (const payload of [
  "//evil.example/checkout",
  "/\\evil.example",
  "javascript:alert(1)",
  "https://evil.example/checkout",
  "/messages\r\nLocation:%20https://evil.example",
]) {
  assert.equal(
    signedOutBookingCheckoutLocation(payload),
    expectedDefaultLocation,
    `unsafe return path falls back safely: ${payload}`,
  );
}

assertSourceOrder(
  "const { data: claimsData } = await supabase.auth.getClaims();",
  "const bookingId = cleanUuid(formData.get(\"booking_id\"));",
  "signed-out checkout authenticates before malformed booking id handling",
);
assertSourceOrder(
  "if (!claims?.sub)",
  "const secretKey = process.env.STRIPE_SECRET_KEY;",
  "signed-out checkout authenticates before payment readiness checks",
);
assertSourceOrder(
  "const bookingId = cleanUuid(formData.get(\"booking_id\"));",
  "const checkoutPreflight = stripeCheckoutPreflight();",
  "malformed signed-in checkout input is handled before payment preflight",
);
assertSourceOrder(
  "const limit = checkRateLimit({",
  "const checkoutPreflight = stripeCheckoutPreflight();",
  "rate limiting remains before checkout preflight and expensive work",
);

assert.ok(
  bookingCheckout.includes("return noStoreRedirect(") &&
    bookingCheckout.includes("/login?message=") &&
    bookingCheckout.includes("Sign in to pay a booking deposit.") &&
    bookingCheckout.includes('returnTo ?? "/account#booking-settings"'),
  "signed-out booking checkout uses no-store login redirect",
);
assert.ok(
  bookingCheckout.includes("return noStoreRedirect(session.url, { status: 303 });"),
  "successful Stripe handoff redirect is no-store",
);
assert.ok(
  publicSmoke.includes('path: "/api/bookings/checkout"') &&
    publicSmoke.includes('redirectIncludes: "/login"') &&
    publicSmoke.includes('"Sign%20in%20to%20pay%20a%20booking%20deposit."') &&
    publicSmoke.includes('"return_to=%2Faccount%23booking-settings"'),
  "public smoke keeps the signed-out booking checkout login gate covered",
);
assert.equal(
  publicSmoke.includes('redirectIncludesAny: ["/login", "/account"]'),
  false,
  "public smoke must not accept the signed-out booking checkout account fallback",
);

console.log("PASS booking checkout redirect contracts");
