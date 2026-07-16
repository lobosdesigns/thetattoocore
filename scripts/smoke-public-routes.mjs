const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const forbiddenBodyText = [
  "This page couldn't load",
  "Reload to try again",
  "Application error",
  "Internal Server Error",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "Cloudflare",
  "Supabase",
  "HostGator",
  "Stripe",
  "service key",
  "service role",
  "lobo3319@gmail.com",
  "lobosden@hotmail.com",
  "D@k0t",
  "Dakota",
  "Calder",
];
const requiredHeaders = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["strict-transport-security", "max-age=31536000"],
  ["permissions-policy", "camera=()"],
  ["permissions-policy", "microphone=()"],
  ["permissions-policy", 'payment=(self "https://checkout.stripe.com")'],
];
const smokeFetchHeaders = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 TheTattooCorePublicSmoke/1.0",
};
const transientStatuses = new Set([429, 502, 503, 504, 599]);
const requestDelayMs = Number.parseInt(process.env.SMOKE_REQUEST_DELAY_MS || "200", 10);
const fetchAttempts = Math.max(
  1,
  Number.parseInt(process.env.SMOKE_FETCH_ATTEMPTS || "3", 10),
);
const fetchTimeoutMs = Math.max(
  1000,
  Number.parseInt(process.env.SMOKE_FETCH_TIMEOUT_MS || "5000", 10),
);
const fetchBackoffMs = Math.max(
  100,
  Number.parseInt(process.env.SMOKE_FETCH_BACKOFF_MS || "400", 10),
);

function isEdgeChallenge(body) {
  const text = body.toLowerCase();

  return (
    text.includes("cloudflare") ||
    text.includes("just a moment") ||
    text.includes("challenge-platform") ||
    text.includes("cf-browser-verification") ||
    text.includes("cf-error-code")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithRetry(url, options = {}, retryOptions = {}) {
  let lastResult;

  for (let attempt = 0; attempt < fetchAttempts; attempt += 1) {
    let response;
    let body;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...smokeFetchHeaders,
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      body = await response.text();
    } catch (error) {
      body = error instanceof Error ? error.message : String(error);
      response = new Response(body, { status: 599 });
    }

    lastResult = { body, response };
    const cloudflareChallenge = retryOptions.retryCloudflareBody && isEdgeChallenge(body);

    if (!transientStatuses.has(response.status) && !cloudflareChallenge) {
      return lastResult;
    }

    if (attempt < fetchAttempts - 1) {
      await sleep(fetchBackoffMs * (attempt + 1));
    }
  }

  return lastResult;
}

async function fetchWithRetry(url, options = {}) {
  let lastResponse;

  for (let attempt = 0; attempt < fetchAttempts; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...smokeFetchHeaders,
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
    } catch (error) {
      response = new Response(error instanceof Error ? error.message : String(error), {
        status: 599,
      });
    }

    lastResponse = response;

    if (!transientStatuses.has(response.status)) {
      return response;
    }

    if (attempt < fetchAttempts - 1) {
      await sleep(fetchBackoffMs * (attempt + 1));
    }
  }

  return lastResponse;
}

const checks = [
  { path: "/", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/account", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Faccount"], redirect: "manual" },
  { path: "/account?booking_status=requested", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Faccount%3Fads%3D25%26bookings%3D25%26orders%3D25%26booking_status%3Drequested"], redirect: "manual" },
  { path: "/admin", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fadmin"], redirect: "manual" },
  { path: "/admin/ads", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/ads?payment_status=problem", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/ads?status=pending_review", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/content", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/data-requests", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/gigs", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/mail-settings", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/media-ops", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch?order_status=pending_checkout", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch?product_status=pending_review", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch?seller_payout=incomplete", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch?fulfillment=needs_fulfillment", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/merch?q=shirt", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?q=pi_test", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?event_type=refund.failed", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?event_type=charge.dispute.created", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=booking_refund_review_requested", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=merch_refund_review_requested", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=booking_refund_problem", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=ad_campaign_credit_granted", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=user_ad_credit_granted", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=payment_disputes", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/payments?audit_type=booking_payment_dispute", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/reports", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/stuff", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/users", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/users?q=ceocore", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/verification", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/api/ad-click", status: [303, 307, 308], redirectIncludes: "/", redirect: "manual" },
  { path: "/api/ad-click?campaign_id=bad&placement=4u", status: [303, 307, 308], redirectIncludes: "/", redirect: "manual" },
  { path: "/api/ad-click?campaign_id=bad&placement=evil", status: [303, 307, 308], redirectIncludes: "/", redirect: "manual" },
  {
    body: "campaign_id=bad",
    method: "POST",
    path: "/api/ads/checkout",
    status: [303],
    redirectIncludes: "/login",
    locationIncludes: ["Sign%20in%20to%20pay%20for%20ads"],
    redirect: "manual",
  },
  {
    body: "booking_id=bad",
    method: "POST",
    path: "/api/bookings/checkout",
    status: [303],
    redirectIncludes: "/login",
    locationIncludes: ["Sign", "booking", "deposit"],
    redirect: "manual",
  },
  { path: "/api/bookings/bad/calendar", status: [303, 307, 308], redirectIncludes: "/login", redirect: "manual" },
  {
    body: "email=smoke%40example.invalid&password=notlongenough&return_to=%2Fmessages",
    method: "POST",
    path: "/auth/signup",
    requestHeaders: { "content-type": "application/x-www-form-urlencoded" },
    status: [307, 308],
    redirectIncludes: "/signup",
    locationIncludes: ["return_to=%2Fmessages"],
    redirect: "manual",
  },
  {
    body: "email=smoke%40example.invalid&password=notlongenough&return_to=%2F%2Fevil.example",
    method: "POST",
    path: "/auth/signup",
    requestHeaders: { "content-type": "application/x-www-form-urlencoded" },
    status: [307, 308],
    redirectIncludes: "/signup",
    locationExcludes: ["return_to=%2F%2Fevil.example"],
    redirect: "manual",
  },
  {
    body: "redirect_to=%2Fsignup&return_to=%2Fmessages",
    method: "POST",
    path: "/auth/resend-confirmation",
    requestHeaders: { "content-type": "application/x-www-form-urlencoded" },
    status: [307, 308],
    redirectIncludes: "/signup",
    locationIncludes: ["return_to=%2Fmessages"],
    redirect: "manual",
  },
  {
    body: "product_id=bad&quantity=1",
    method: "POST",
    path: "/api/merch/checkout",
    status: [303],
    redirectIncludes: "/login",
    locationIncludes: ["Sign+in+to+buy+merch", "return_to=%2Fmerch%2Fbad"],
    redirect: "manual",
  },
  {
    method: "POST",
    path: "/api/stripe/connect/onboarding",
    status: [303],
    redirectIncludes: "/login",
    locationIncludes: ["return_to=%2Faccount%23order-settings"],
    redirect: "manual",
  },
  {
    body: JSON.stringify({ id: "evt_unsigned_smoke" }),
    method: "POST",
    path: "/api/stripe/webhook",
    requestHeaders: { "content-type": "application/json" },
    status: [400],
    includes: ['"Missing payment verification."'],
    headers: false,
  },
  {
    body: JSON.stringify({ recipientEmail: "support@thetattoocore.com" }),
    method: "POST",
    path: "/api/admin/mail/test",
    requestHeaders: { "content-type": "application/json" },
    status: [401],
    includes: ['"Sign in required."'],
    headers: false,
  },
  {
    body: "title=Guest%20spot",
    method: "POST",
    path: "/api/gigs",
    status: [303],
    redirectIncludes: "/login",
    redirect: "manual",
  },
  {
    body: JSON.stringify({
      endpoint: "https://example.com/push",
      keys: { auth: "1234567890", p256dh: "123456789012345678901" },
    }),
    method: "POST",
    path: "/api/push/subscriptions",
    requestHeaders: { "content-type": "application/json" },
    status: [401],
    includes: ['"Sign in required."'],
    headers: false,
  },
  {
    body: JSON.stringify({ endpoint: "https://example.com/push" }),
    method: "DELETE",
    path: "/api/push/subscriptions",
    requestHeaders: { "content-type": "application/json" },
    status: [401],
    includes: ['"Sign in required."'],
    headers: false,
  },
  {
    body: JSON.stringify({ campaign_id: "bad", placement: "evil" }),
    method: "POST",
    path: "/api/ad-events",
    requestHeaders: { "content-type": "application/json" },
    status: [400],
    includes: ['"Invalid event."'],
    headers: false,
  },
  { path: "/messages", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fmessages"], redirect: "manual" },
  { path: "/notifications", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fnotifications"], redirect: "manual" },
  { path: "/saved", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fsaved"], redirect: "manual" },
  {
    path: "/login",
    status: [200],
    includes: [
      'name="robots" content="noindex, nofollow"',
      "Sign in",
      "Create new account",
      "No AI feed",
      "No scratchers",
      "18+",
      "Support",
      "Help Center",
      "Terms",
      "Privacy",
      "TheTattooCore",
    ],
    excludes: ['action="/auth/signup"', 'name="age_confirmed"'],
  },
  {
    path: "/signup",
    status: [200],
    includes: [
      'name="robots" content="noindex, nofollow"',
      "Create account",
      'action="/auth/signup"',
      'name="age_confirmed"',
      "Already have an account? Sign in",
      "Support",
      "Help Center",
      "Terms",
      "Privacy",
    ],
    excludes: ['action="/auth/login"', 'name="return_to"'],
  },
  {
    path: "/login?return_to=%2Fmessages",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', 'name="return_to"', 'value="/messages"'],
  },
  {
    path: "/signup?return_to=%2Fp%2Fnot-a-real-post",
    status: [200],
    includes: [
      'name="robots" content="noindex, nofollow"',
      'name="return_to"',
      'value="/p/not-a-real-post"',
      "/login?return_to=%2Fp%2Fnot-a-real-post",
    ],
  },
  {
    path: "/signup?return_to=%2F%2Fevil.example",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Create account"],
    excludes: ['name="return_to"', 'value="//evil.example"'],
  },
  {
    path: "/login?return_to=%2F%2Fevil.example",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Sign in"],
    excludes: ['name="return_to"', 'value="//evil.example"'],
  },
  {
    path: "/forgot-password",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Reset password", "Send reset link", "Support", "Help Center", "Terms", "Privacy"],
  },
  {
    path: "/reset-password",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Create new password", "Support", "Help Center", "Terms", "Privacy"],
  },
  { path: "/auth/confirm?next=%2F%2Fevil.example&code=bad", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  {
    path: "/support",
    status: [200],
    includes: [
      "Support",
      "Help Center",
      'href="/help"',
      "Request deletion",
      "/login?return_to=%2Faccount%23data-settings",
      "visible nudity",
      "Merch checkout is limited during launch",
      "How-To Library",
      "FAQ and screenshot tutorial topics",
      "Popular Help Guides",
      "/help/booking-appointments",
      "/help/privacy-safety-support",
      "/help/verification-documents",
      "support@thetattoocore.com",
      'href="/terms"',
      'href="/privacy"',
    ],
  },
  {
    path: "/help",
    status: [200],
    includes: [
      "Help Center",
      "Search Help Center",
      "Search bookings, ads, Merch, verification",
      "Tutorial Library",
      "Article Comments",
      "/help/booking-appointments",
      "/help/search-saved-people",
      "/help/privacy-safety-support",
      "booking deposits",
      "search, find people, and use Saved",
      "reports, blocks, privacy, and support",
      "create an ad and use ad credits",
      "set up Merch products",
      "submit artist, studio, or vendor verification",
      "Last reviewed July 15, 2026",
      "pin official",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/booking-appointments",
    status: [200],
    includes: [
      "How to create appointment types, time slots, and booking deposits",
      "Steps",
      "FAQ",
      "When does a client pay a deposit?",
      "Google Calendar, Apple/iCloud Calendar, and standard iCalendar",
      "How do I prevent bad appointment times?",
      "private calendar file",
      "FAQPage",
      "acceptedAnswer",
      "Related Guides",
      "Last reviewed July 15, 2026",
      "/help/artist-profile-shop-links",
      "Screenshots And Tutorials",
      "Guide Questions",
      "pin official replies",
      "All guides",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/search-saved-people",
    status: [200],
    includes: [
      "How to search, find people, and use Saved",
      "Steps",
      "FAQ",
      "What should I type in Search?",
      "shops/studios",
      "bookings/appointments",
      "Why can I not find someone or something?",
      "FAQPage",
      "acceptedAnswer",
      "Related Guides",
      "Last reviewed July 15, 2026",
      "/help/artist-profile-shop-links",
      "All guides",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/privacy-safety-support",
    status: [200],
    includes: [
      "How to use reports, blocks, privacy, and support",
      "When should I report something?",
      "How do account deletion requests work?",
      "Support",
      "Account data controls",
      "Related Guides",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/artist-profile-shop-links",
    status: [200],
    includes: [
      "How to set up an artist profile and link a studio",
      "profile photo, banner, short bio, website, and social links",
      "Can artists connect to a shop profile?",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/verification-documents",
    status: [200],
    includes: [
      "How to submit artist, studio, or vendor verification",
      "What document should I upload?",
      "Will my license document be public?",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/ads-and-credits",
    status: [200],
    includes: [
      "How to create an ad and use ad credits",
      "How do ad credits work?",
      "Why does my ad need review?",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/merch-products-orders?smoke_cache_bust=merch-guide",
    status: [200],
    includes: [
      "How to set up Merch products and handle orders",
      "What belongs in Merch?",
      "Can fans buy Merch?",
      "When should I mark a Merch order fulfilled?",
      "Buyer shipping details are private order information",
      "seller order card",
      "tracking number",
      "refund review",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/help/posting-stories-dms",
    status: [200],
    includes: [
      "How to create Stuff listings, Gigs, Stories, and DMs safely",
      "Why does the create form change?",
      "Can I post tattoo placement photos with nudity?",
      "FAQPage",
      "Last reviewed July 15, 2026",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/privacy",
    status: [200],
    includes: [
      "Privacy",
      "Account And Profile Data",
      "Commerce And Payments",
      "raw payment or payout credentials",
      "Retention And Review",
      "/login?return_to=%2Faccount%23data-settings",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/terms",
    status: [200],
    includes: [
      "Terms",
      "visible nudity is not allowed",
      "No AI And No Scratchers",
      "Stuff, Merch, And Gigs",
      "Public And Sensitive Visibility",
      "support@thetattoocore.com",
    ],
  },
  {
    path: "/search",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Search"],
  },
  {
    path: "/search?q=ceocore",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "CEOCore", "@ceocore"],
  },
  {
    path: "/search?q=ceocore&type=profiles",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "CEOCore", "@ceocore"],
  },
  {
    path: "/merch",
    status: [200],
    includes: ["Merch", "Search shirts, prints, art, stickers", "Filters"],
  },
  {
    path: "/merch?category=apparel&sort=price_low",
    status: [200],
    includes: ["Merch", "Apparel", "Low price"],
  },
  {
    path: "/merch?q=shirt",
    status: [200],
    includes: ["Merch", "Search shirts, prints, art, stickers"],
  },
  {
    path: "/p/not-a-real-post",
    status: [404],
    includes: ["4U post not found"],
  },
  {
    path: "/t/not-a-real-thread",
    status: [404],
    includes: ["Gossip thread not found"],
  },
  {
    path: "/stuff/not-a-real-listing",
    status: [404],
    includes: ["Stuff listing not found"],
  },
  {
    path: "/gigs/not-a-real-gig",
    status: [404],
    includes: ["Gig not found"],
  },
  {
    path: "/merch/not-a-real-product",
    status: [404],
    includes: ["Merch not found"],
  },
  {
    path: "/u/ceocore",
    status: [200],
    includes: [
      "CEOCore",
      "@ceocore",
      'property="og:title"',
      'property="og:image"',
      'name="twitter:card"',
      'name="twitter:image"',
    ],
  },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-4u",
    status: [200],
    includes: ["CEOCore", "@ceocore", "4U", "Gossip", "Stuff", "Gigs", "Merch"],
  },
  {
    path: "/u/ceocore/followers",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Private community", "Back to profile"],
  },
  {
    path: "/u/ceocore/following",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Private community", "Back to profile"],
  },
  {
    path: "/merch/checkout/success",
    status: [200],
    includes: ['name="robots" content="noindex, nofollow"', "Checkout received", "Back to Merch"],
  },
  {
    path: "/robots.txt",
    status: [200],
    includes: ["User-agent"],
    headers: false,
    allowedForbiddenText: ["Cloudflare"],
  },
  { path: "/sitemap.xml", status: [200], includes: ["urlset"] },
  { path: "/manifest.webmanifest", status: [200], includes: ["TheTattooCore", "/icons/icon-192.png"], headers: false },
  { path: "/sw.js", status: [200], includes: ["skipWaiting", "showNotification", "notificationclick"], headers: false },
];

const pwaManifestRequirements = {
  display: "standalone",
  start_url: "/login",
  scope: "/",
  theme_color: "#171412",
};
const sitemapSampleLimit = Number.parseInt(process.env.SMOKE_SITEMAP_LIMIT || "25", 10);
const privateSitemapPathPrefixes = [
  "/account",
  "/admin",
  "/auth",
  "/forgot-password",
  "/login",
  "/messages",
  "/notifications",
  "/reset-password",
  "/saved",
  "/search",
  "/signup",
];
const requiredRobotsDisallows = [
  "/account",
  "/admin",
  "/api",
  "/auth",
  "/forgot-password",
  "/login",
  "/messages",
  "/notifications",
  "/reset-password",
  "/saved",
  "/search",
  "/signup",
];
const representativeSitemapPrefixes = ["/p/", "/t/", "/stuff/", "/gigs/", "/merch/", "/u/"];

let failures = 0;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const { response, body } = await fetchTextWithRetry(
    url,
    {
      body: check.body,
      headers:
        check.requestHeaders ||
        (check.method === "POST"
          ? { "content-type": "application/x-www-form-urlencoded" }
          : undefined),
      method: check.method || "GET",
      redirect: check.redirect || "follow",
    },
    { retryCloudflareBody: true },
  );
  const searchableBody = body.replace(/<!--.*?-->/g, "");
  if (isEdgeChallenge(body)) {
    console.warn(`WARN ${check.path} skipped after unresolved edge challenge (${response.status})`);
    await sleep(Number.isFinite(requestDelayMs) ? requestDelayMs : 200);
    continue;
  }

  const okStatus = check.status.includes(response.status);
  const location = response.headers.get("location") || "";
  const okRedirect = check.redirectIncludes ? location.includes(check.redirectIncludes) : true;
  const missingLocationText = (check.locationIncludes || []).filter(
    (text) => !location.includes(text),
  );
  const unexpectedLocationText = (check.locationExcludes || []).filter(
    (text) => location.includes(text),
  );
  const missingText = (check.includes || []).filter(
    (text) => !searchableBody.includes(text),
  );
  const unexpectedText = (check.excludes || []).filter(
    (text) => searchableBody.includes(text),
  );
  const allowedForbiddenText = check.allowedForbiddenText || [];
  const leakedText = forbiddenBodyText.filter(
    (text) => !allowedForbiddenText.includes(text) && body.includes(text),
  );
  const missingHeaders = check.redirect || check.headers === false
    ? []
    : requiredHeaders.filter(([header, value]) => {
        const headerValue = response.headers.get(header) || "";

        return !headerValue.includes(value);
      });

  if (
    !okStatus ||
    !okRedirect ||
    missingLocationText.length > 0 ||
    unexpectedLocationText.length > 0 ||
    missingText.length > 0 ||
    unexpectedText.length > 0 ||
    leakedText.length > 0 ||
    missingHeaders.length > 0
  ) {
    failures += 1;
    console.error(`FAIL ${check.path}`);
    console.error(`  status: ${response.status}, expected: ${check.status.join(" or ")}`);
    if (check.redirectIncludes) {
      console.error(`  location: ${location || "(none)"}, expected to include: ${check.redirectIncludes}`);
    }
    if (missingText.length > 0) {
      console.error(`  missing text: ${missingText.join(", ")}`);
    }
    if (unexpectedText.length > 0) {
      console.error(`  unexpected text: ${unexpectedText.join(", ")}`);
    }
    if (missingLocationText.length > 0) {
      console.error(`  location: ${location || "(none)"}`);
      console.error(`  missing location text: ${missingLocationText.join(", ")}`);
    }
    if (unexpectedLocationText.length > 0) {
      console.error(`  location: ${location || "(none)"}`);
      console.error(`  unexpected location text: ${unexpectedLocationText.join(", ")}`);
    }
    if (leakedText.length > 0) {
      console.error(`  forbidden text present: ${leakedText.join(", ")}`);
    }
    if (missingHeaders.length > 0) {
      console.error(
        `  missing headers: ${missingHeaders
          .map(([header, value]) => `${header} includes ${value}`)
          .join(", ")}`,
      );
    }
    continue;
  }

  console.log(`PASS ${check.path}`);
  await sleep(Number.isFinite(requestDelayMs) ? requestDelayMs : 200);
}

await checkPwaManifest();
await checkRobotsPolicy();
await checkSitemapUrls();
await checkRemovedScaffoldAssets();

if (failures > 0) {
  console.error(`${failures} public route smoke check(s) failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`All public route smoke checks passed for ${baseUrl}`);

async function checkPwaManifest() {
  const manifestUrl = `${baseUrl}/manifest.webmanifest`;
  const { response, body } = await fetchTextWithRetry(manifestUrl);

  if (isEdgeChallenge(body)) {
    console.warn(`WARN /manifest.webmanifest skipped after unresolved edge challenge (${response.status})`);
    return;
  }

  if (!response.ok) {
    failures += 1;
    console.error(`FAIL /manifest.webmanifest`);
    console.error(`  status: ${response.status}, expected: 200`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(body);
  } catch (error) {
    failures += 1;
    console.error(`FAIL /manifest.webmanifest`);
    console.error(`  invalid JSON: ${error.message}`);
    return;
  }

  const missingFields = Object.entries(pwaManifestRequirements)
    .filter(([field, expected]) => manifest[field] !== expected)
    .map(([field, expected]) => `${field}=${expected}`);
  const requiredIcons = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];
  const requiredScreenshots = ["/screenshots/mobile-home.png", "/screenshots/desktop-home.png"];
  const requiredShortcuts = [
    "/#feed",
    "/#threads",
    "/#marketplace",
    "/#gigs",
    "/messages",
    "/notifications",
    "/#merch",
  ];
  const manifestIcons = new Set((manifest.icons || []).map((icon) => icon.src));
  const manifestScreenshots = new Set((manifest.screenshots || []).map((screenshot) => screenshot.src));
  const manifestShortcuts = new Set((manifest.shortcuts || []).map((shortcut) => shortcut.url));
  const missingIcons = requiredIcons.filter((src) => !manifestIcons.has(src));
  const missingScreenshots = requiredScreenshots.filter((src) => !manifestScreenshots.has(src));
  const missingShortcuts = requiredShortcuts.filter((url) => !manifestShortcuts.has(url));

  if (
    manifest.name !== "TheTattooCore" ||
    manifest.short_name !== "TTC" ||
    missingFields.length > 0 ||
    missingIcons.length > 0 ||
    missingScreenshots.length > 0 ||
    missingShortcuts.length > 0
  ) {
    failures += 1;
    console.error(`FAIL /manifest.webmanifest`);
    if (manifest.name !== "TheTattooCore") console.error(`  name: ${manifest.name}`);
    if (manifest.short_name !== "TTC") console.error(`  short_name: ${manifest.short_name}`);
    if (missingFields.length > 0) console.error(`  missing/wrong fields: ${missingFields.join(", ")}`);
    if (missingIcons.length > 0) console.error(`  missing icons: ${missingIcons.join(", ")}`);
    if (missingScreenshots.length > 0) {
      console.error(`  missing screenshots: ${missingScreenshots.join(", ")}`);
    }
    if (missingShortcuts.length > 0) {
      console.error(`  missing shortcuts: ${missingShortcuts.join(", ")}`);
    }
    return;
  }

  const assetPaths = [...requiredIcons, ...requiredScreenshots];
  const missingAssets = [];

  for (const path of assetPaths) {
    const assetResponse = await fetchWithRetry(`${baseUrl}${path}`, { method: "HEAD" });
    if (!assetResponse.ok) {
      missingAssets.push(`${path} (${assetResponse.status})`);
    }
  }

  if (missingAssets.length > 0) {
    failures += 1;
    console.error(`FAIL PWA assets`);
    console.error(`  unreachable: ${missingAssets.join(", ")}`);
    return;
  }

  console.log("PASS PWA manifest installability fields");
}

async function checkRobotsPolicy() {
  const { response, body } = await fetchTextWithRetry(`${baseUrl}/robots.txt`);

  if (isEdgeChallenge(body)) {
    console.warn(`WARN robots policy skipped after unresolved edge challenge (${response.status})`);
    return;
  }

  if (!response.ok) {
    failures += 1;
    console.error(`FAIL robots policy`);
    console.error(`  status: ${response.status}, expected: 200`);
    return;
  }

  const missingDisallows = requiredRobotsDisallows.filter(
    (path) => !body.includes(`Disallow: ${path}`),
  );
  const missingAllows = ["/p/", "/t/", "/u/", "/stuff/", "/gigs/", "/merch/"].filter(
    (path) => !body.includes(`Allow: ${path}`),
  );

  if (
    missingDisallows.length > 0 ||
    missingAllows.length > 0 ||
    !body.includes(`Sitemap: ${baseUrl}/sitemap.xml`)
  ) {
    failures += 1;
    console.error(`FAIL robots policy`);
    if (missingDisallows.length > 0) {
      console.error(`  missing disallows: ${missingDisallows.join(", ")}`);
    }
    if (missingAllows.length > 0) {
      console.error(`  missing public allows: ${missingAllows.join(", ")}`);
    }
    if (!body.includes(`Sitemap: ${baseUrl}/sitemap.xml`)) {
      console.error(`  missing sitemap URL`);
    }
    return;
  }

  console.log("PASS robots public/private policy");
}

async function checkSitemapUrls() {
  const { response, body } = await fetchTextWithRetry(`${baseUrl}/sitemap.xml`);

  if (isEdgeChallenge(body)) {
    console.warn(`WARN sitemap sample skipped after unresolved edge challenge (${response.status})`);
    return;
  }

  if (!response.ok) {
    failures += 1;
    console.error(`FAIL sitemap sample`);
    console.error(`  status: ${response.status}, expected: 200`);
    return;
  }

  const xml = body;
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const badUrls = [];
  const publicUrls = [];
  const requiredSitemapUrls = [`${baseUrl}/merch`];
  const missingRequiredUrls = requiredSitemapUrls.filter((url) => !urls.includes(url));

  if (missingRequiredUrls.length > 0) {
    failures += 1;
    console.error(`FAIL sitemap required URLs`);
    console.error(`  missing: ${missingRequiredUrls.join(", ")}`);
    return;
  }

  for (const url of urls) {
    try {
      const parsed = new URL(url);

      if (parsed.origin !== baseUrl) {
        badUrls.push(`${url} (wrong origin)`);
        continue;
      }

      if (privateSitemapPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
        badUrls.push(`${url} (private path)`);
        continue;
      }

      publicUrls.push(parsed);
    } catch {
      badUrls.push(`${url} (invalid URL)`);
    }
  }

  if (badUrls.length > 0) {
    failures += 1;
    console.error(`FAIL sitemap URLs`);
    console.error(`  invalid entries: ${badUrls.slice(0, 10).join(", ")}`);
    return;
  }

  const sampleLimit = Number.isFinite(sitemapSampleLimit) ? sitemapSampleLimit : 25;
  const representativeUrls = representativeSitemapPrefixes
    .map((prefix) => publicUrls.find((url) => url.pathname.startsWith(prefix)))
    .filter(Boolean);
  const sampledUrls = [
    ...representativeUrls,
    ...publicUrls.filter(
      (url) => !representativeUrls.some((sampled) => sampled.href === url.href),
    ),
  ].slice(0, sampleLimit);
  const failedSamples = [];

  for (const url of sampledUrls) {
    const { response: sampleResponse, body: sampleBody } = await fetchTextWithRetry(
      url,
      {
        redirect: "follow",
      },
      { retryCloudflareBody: true },
    );
    const leakedText = forbiddenBodyText.filter((text) => sampleBody.includes(text));
    const challenge = isEdgeChallenge(sampleBody);

    if (challenge) {
      console.warn(`WARN ${url.pathname} sitemap sample skipped after unresolved edge challenge (${sampleResponse.status})`);
      continue;
    }

    if (!sampleResponse.ok || leakedText.length > 0) {
      failedSamples.push(
        `${url.pathname} (${sampleResponse.status}${
          leakedText.length ? `, forbidden: ${leakedText.join(", ")}` : ""
        })`,
      );
    }
  }

  if (failedSamples.length > 0) {
    failures += 1;
    console.error(`FAIL sitemap sample`);
    console.error(`  failing URLs: ${failedSamples.join(", ")}`);
    return;
  }

  console.log(`PASS sitemap URL sample (${sampledUrls.length}/${publicUrls.length})`);
}

async function checkRemovedScaffoldAssets() {
  const removedAssets = [
    "/file.svg",
    "/globe.svg",
    "/next.svg",
    "/vercel.svg",
    "/window.svg",
  ];
  const stillPublic = [];

  for (const path of removedAssets) {
    const { response, body } = await fetchTextWithRetry(
      `${baseUrl}${path}`,
      { redirect: "manual" },
      { retryCloudflareBody: true },
    );

    if (isEdgeChallenge(body)) {
      console.warn(`WARN ${path} scaffold asset check skipped after unresolved edge challenge (${response.status})`);
      continue;
    }

    if (![404, 307, 308].includes(response.status)) {
      stillPublic.push(`${path} (${response.status})`);
    }
  }

  if (stillPublic.length > 0) {
    failures += 1;
    console.error("FAIL removed scaffold assets");
    console.error(`  still public: ${stillPublic.join(", ")}`);
    return;
  }

  console.log("PASS removed scaffold assets stay unavailable");
}
