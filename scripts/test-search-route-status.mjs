const baseUrl = (process.env.SEARCH_STATUS_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3014").replace(/\/$/, "");

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
    label: "default search",
    path: "/search",
    status: 200,
    includes: ["Search", 'name="robots" content="noindex, nofollow"'],
  },
  {
    label: "artist query",
    path: "/search?q=ceocore&type=profiles",
    status: 200,
    includes: ["Search", "CEOCore"],
  },
  {
    label: "studio/shop query",
    path: "/search?q=shops&category=studio&type=profiles",
    status: 200,
    includes: ["Search", "Profiles"],
  },
  {
    label: "tattoo style query",
    path: "/search?q=tattoo&style=flash&type=feed",
    status: 200,
    includes: ["Search", "4U"],
  },
  {
    label: "location query",
    path: "/search?q=tattoo&city=Dallas&region=TX",
    status: 200,
    includes: ["Search", "0 results found", "No matches yet"],
  },
  {
    label: "Gossip query",
    path: "/search?q=gossip&type=threads",
    status: 200,
    includes: ["Search", "Gossip"],
  },
  {
    label: "gig query",
    path: "/search?q=guestspot&type=gigs",
    status: 200,
    includes: ["Search", "Gigs"],
  },
  {
    label: "merch query",
    path: "/search?q=shirts&type=merch&category=apparel",
    status: 200,
    includes: ["Search", "Merch"],
  },
  {
    label: "no results query",
    path: "/search?q=zzzzphase2nomatch",
    status: 200,
    includes: ["Search", "No matches yet"],
  },
  {
    label: "malformed query",
    path: "/search?q=%21%21%21&type=bad&page=-999&sort=bad&category=%3Cscript%3E",
    status: 200,
    includes: ["Search"],
    excludes: ["CEOCore", "@ceocore"],
  },
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route.path}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "TheTattooCoreSearchStatusSmoke/1.0",
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

  console.log(`PASS ${route.label} ${route.path} -> ${response.status}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`All search route status checks passed for ${baseUrl}`);
