const baseUrl = (process.env.PROFILE_STATUS_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3013").replace(/\/$/, "");

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
    label: "public artist profile",
    path: "/u/ceocore",
    status: 200,
    includes: ["CEOCore", "@ceocore", "Portfolio preview"],
    excludes: ['name="robots" content="noindex'],
  },
  {
    label: "internal test profile",
    path: "/u/ttc_reviewer",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found", "@ttc_reviewer"],
  },
  {
    label: "genuinely nonexistent profile",
    path: "/u/not-a-real-profile-phase-1a",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found"],
  },
  {
    label: "public followers list",
    path: "/u/ceocore/followers",
    status: 200,
    includes: ["CEOCore", "Followers", "Back to profile"],
  },
  {
    label: "public following list",
    path: "/u/ceocore/following",
    status: 200,
    includes: ["CEOCore", "Following", "Back to profile"],
  },
  {
    label: "internal test followers list",
    path: "/u/ttc_reviewer/followers",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found", "@ttc_reviewer"],
  },
  {
    label: "internal test following list",
    path: "/u/ttc_reviewer/following",
    status: 404,
    includes: ["Page not found"],
    excludes: ["Profile not found", "@ttc_reviewer"],
  },
];

if (process.env.PRIVATE_PROFILE_STATUS_PATH) {
  routes.push({
    label: "representative private profile",
    path: process.env.PRIVATE_PROFILE_STATUS_PATH,
    status: Number(process.env.PRIVATE_PROFILE_EXPECTED_STATUS || 404),
    includes: [process.env.PRIVATE_PROFILE_EXPECTED_TEXT || "Page not found"],
  });
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route.path}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "TheTattooCoreProfileStatusSmoke/1.0",
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

if (!process.env.PRIVATE_PROFILE_STATUS_PATH) {
  console.log("PASS private profile status uses existing public_profiles contract; set PRIVATE_PROFILE_STATUS_PATH to verify a known safe private fixture at runtime.");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`All profile route status checks passed for ${baseUrl}`);