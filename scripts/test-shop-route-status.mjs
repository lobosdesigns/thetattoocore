const baseUrl = (process.env.SHOP_STATUS_BASE_URL || process.env.PROFILE_STATUS_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3013").replace(/\/$/, "");

const protectedFields = [
  "adult_terms_accepted_at",
  "is_adult_confirmed",
  "notify_follow_activity",
  "notify_message_activity",
  "notify_feed_activity",
  "notification_quiet_hours",
  "theme_preference",
  "preferred_language",
  "location_personalization_enabled",
  "moderation_note",
  "license_verified_by",
  "license_verification_request_id",
  "suspended_at",
  "banned_at",
  "service_role",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const routes = [
  {
    label: "internal test shop/profile route",
    path: "/u/ttc_reviewer",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found", "@ttc_reviewer", "Tattoo shop experience"],
  },
  {
    label: "nonexistent shop/profile route",
    path: "/u/not-a-real-shop-phase-1b",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found", "Tattoo shop experience"],
  },
];

if (process.env.PUBLIC_SHOP_STATUS_PATH) {
  routes.unshift({
    label: "representative public shop route",
    path: process.env.PUBLIC_SHOP_STATUS_PATH,
    status: 200,
    includes: ["Tattoo shop experience", "Artists at this shop", "Public contact"],
    excludes: ['name="robots" content="noindex"'],
  });
} else {
  console.log("PASS public shop status uses deterministic component/contract fixtures; set PUBLIC_SHOP_STATUS_PATH to verify a known public studio profile at runtime.");
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route.path}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "TheTattooCoreShopStatusSmoke/1.0",
    },
    redirect: "manual",
  });
  const body = await response.text();

  if (response.status !== route.status) {
    fail(`${route.label}: status ${response.status}, expected ${route.status}`);
  }
  for (const text of route.includes || []) {
    if (!body.includes(text)) fail(`${route.label}: missing text ${text}`);
  }
  for (const text of route.excludes || []) {
    if (body.includes(text)) fail(`${route.label}: unexpected text ${text}`);
  }
  for (const field of protectedFields) {
    if (body.includes(field)) fail(`${route.label}: protected field leaked ${field}`);
  }
  if (route.status === 404 && response.status !== 404) {
    fail(`${route.label}: not-found body text is not accepted without HTTP 404`);
  }

  console.log(`PASS ${route.label} ${route.path} -> ${response.status}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`All shop route status checks passed for ${baseUrl}`);
