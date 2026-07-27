import { readFileSync } from "node:fs";

const reliability = readFileSync("src/lib/http/reliability.ts", "utf8");
const adClick = readFileSync("src/app/api/ad-click/route.ts", "utf8");
const adEvents = readFileSync("src/app/api/ad-events/route.ts", "utf8");
const messageHistory = readFileSync("src/app/api/messages/history/route.ts", "utf8");
const nativePushTest = readFileSync("src/app/api/push/devices/test/route.ts", "utf8");
const merchCheckout = readFileSync("src/app/api/merch/checkout/route.ts", "utf8");
const bookingCheckout = readFileSync("src/app/api/bookings/checkout/route.ts", "utf8");

function assert(ok, message) {
  if (!ok) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS ${message}`);
}

function appearsInOrder(source, snippets) {
  let cursor = 0;

  return snippets.every((snippet) => {
    const index = source.indexOf(snippet, cursor);

    if (index === -1) return false;

    cursor = index + snippet.length;
    return true;
  });
}

assert(
  reliability.includes(
    '"private, no-store, max-age=0, must-revalidate"',
  ) &&
    reliability.includes("export function noStoreJson") &&
    reliability.includes("export function noStoreRedirect") &&
    reliability.includes("export function rateLimitedJson") &&
    reliability.includes('"Retry-After"'),
  "shared API helpers apply no-store cache privacy and generic retry responses",
);

assert(
  reliability.includes('request.headers.get("cf-connecting-ip")') &&
    !reliability.includes("x-forwarded-for") &&
    !reliability.includes("x-real-ip") &&
    reliability.includes('value.includes(",")') &&
    reliability.includes("ip:${trustedPlatformIp(request) ?? \"anonymous\"}"),
  "rate-limit fallback avoids arbitrary forwarded headers",
);

assert(
  reliability.includes("Symbol.for(\"ttc.localRateLimitState\")") &&
    reliability.includes("const maxBuckets = 10_000") &&
    reliability.includes("pruneExpiredBuckets") &&
    reliability.includes("current.count >= limit"),
  "local rate-limit buckets are bounded and reset by window",
);

assert(
  appearsInOrder(adEvents, [
    "checkRateLimit({",
    "if (limit.limited)",
    "hasSafeJsonBody(request)",
    "await request.json()",
  ]) &&
    adEvents.includes("const maxEventBodyBytes = 2048") &&
    adEvents.includes('scope: "ad-event"') &&
    adEvents.includes("rateLimitedJson(limit.retryAfterSeconds)") &&
    !adEvents.includes("NextResponse.json("),
  "ad impression endpoint rate-limits before parsing and rejects oversized JSON",
);

assert(
  adClick.includes('scope: "ad-click"') &&
    adClick.includes("noStoreRedirect(fallback") &&
    adClick.includes("noStoreRedirect(target") &&
    adClick.includes('"Retry-After": String(limit.retryAfterSeconds)') &&
    !adClick.includes("NextResponse.redirect(fallback"),
  "ad click redirects are no-store and locally rate-limited",
);

assert(
  appearsInOrder(messageHistory, [
    "supabase.auth.getClaims()",
    "if (!userId)",
    "checkRateLimit({",
    'scope: "message-history"',
    'request.nextUrl.searchParams.get("conversationId")',
  ]) &&
    messageHistory.includes("identity: userId") &&
    messageHistory.includes("noStoreJson({") &&
    !messageHistory.includes("NextResponse.json("),
  "DM history stays auth-first, user-keyed, paginated, and no-store",
);

assert(
  appearsInOrder(nativePushTest, [
    "authenticatedProfile()",
    "nativePushQaRoleAllowed(profile.role)",
    "checkRateLimit({",
    'scope: "native-push-test"',
    "readNativePushQaTarget(request)",
  ]) &&
    nativePushTest.includes("identity: profile.id") &&
    nativePushTest.includes("limit: 6") &&
    !nativePushTest.includes("NextResponse.json("),
  "native notification test-send is role-gated before bounded user rate limits",
);

assert(
  merchCheckout.includes('scope: "merch-checkout"') &&
    merchCheckout.includes("identity: claims.sub") &&
    merchCheckout.includes("limit: 8") &&
    appearsInOrder(merchCheckout, [
      "if (!claims?.sub)",
      "checkRateLimit({",
      "const checkoutPreflight = stripeCheckoutPreflight()",
      "const orderId = crypto.randomUUID()",
    ]),
  "Merch checkout rate-limits authenticated users before payment reservation work",
);

assert(
  bookingCheckout.includes('scope: "booking-checkout"') &&
    bookingCheckout.includes("identity: claims.sub") &&
    bookingCheckout.includes("limit: 8") &&
    appearsInOrder(bookingCheckout, [
      "if (!claims?.sub)",
      "checkRateLimit({",
      "const checkoutPreflight = stripeCheckoutPreflight()",
      '.rpc("reserve_booking_deposit_checkout"',
    ]),
  "booking checkout rate-limits authenticated users before deposit reservation work",
);

if (process.exitCode) {
  console.error("Performance and reliability contract checks failed.");
  process.exit(process.exitCode);
}

console.log("All performance and reliability contract checks passed.");
