const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const forbiddenBodyText = [
  "This page couldn't load",
  "Reload to try again",
  "Application error",
  "Internal Server Error",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
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

const checks = [
  { path: "/", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/account", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Faccount"], redirect: "manual" },
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
  { path: "/admin/payments", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/reports", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/stuff", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/users", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/admin/verification", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/messages", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fmessages"], redirect: "manual" },
  { path: "/notifications", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fnotifications"], redirect: "manual" },
  { path: "/saved", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fsaved"], redirect: "manual" },
  {
    path: "/login",
    status: [200],
    includes: ["Sign in", "Create new account", "TheTattooCore"],
    excludes: ['action="/auth/signup"', 'name="age_confirmed"'],
  },
  {
    path: "/signup",
    status: [200],
    includes: [
      "Create account",
      'action="/auth/signup"',
      'name="age_confirmed"',
      "Already have an account? Sign in",
    ],
  },
  {
    path: "/login?return_to=%2Fmessages",
    status: [200],
    includes: ['name="return_to"', 'value="/messages"'],
  },
  {
    path: "/login?return_to=%2F%2Fevil.example",
    status: [200],
    includes: ["Sign in"],
    excludes: ['name="return_to"', 'value="//evil.example"'],
  },
  { path: "/forgot-password", status: [200], includes: ["Reset password", "Send reset link"] },
  { path: "/reset-password", status: [200], includes: ["Create new password"] },
  { path: "/auth/confirm?next=%2F%2Fevil.example&code=bad", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/support", status: [200], includes: ["Support", "support@thetattoocore.com"] },
  { path: "/privacy", status: [200], includes: ["Privacy", "support@thetattoocore.com"] },
  { path: "/terms", status: [200], includes: ["Terms", "support@thetattoocore.com"] },
  { path: "/search", status: [200], includes: ["Search"] },
  { path: "/search?q=ceocore", status: [200], includes: ["CEOCore", "@ceocore"] },
  { path: "/search?q=ceocore&type=profiles", status: [200], includes: ["CEOCore", "@ceocore"] },
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
  { path: "/u/ceocore/followers", status: [200], includes: ["Private community", "Back to profile"] },
  { path: "/u/ceocore/following", status: [200], includes: ["Private community", "Back to profile"] },
  { path: "/merch/checkout/success", status: [200], includes: ["Checkout received", "Back to Merch"] },
  { path: "/robots.txt", status: [200], includes: ["User-agent"], headers: false },
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
  "/messages",
  "/notifications",
  "/reset-password",
  "/saved",
];

let failures = 0;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, { redirect: check.redirect || "follow" });
  const body = await response.text();
  const searchableBody = body.replace(/<!--.*?-->/g, "");
  const okStatus = check.status.includes(response.status);
  const location = response.headers.get("location") || "";
  const okRedirect = check.redirectIncludes ? location.includes(check.redirectIncludes) : true;
  const missingLocationText = (check.locationIncludes || []).filter(
    (text) => !location.includes(text),
  );
  const missingText = (check.includes || []).filter(
    (text) => !searchableBody.includes(text),
  );
  const unexpectedText = (check.excludes || []).filter(
    (text) => searchableBody.includes(text),
  );
  const leakedText = forbiddenBodyText.filter((text) => body.includes(text));
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
}

await checkPwaManifest();
await checkSitemapUrls();

if (failures > 0) {
  console.error(`${failures} public route smoke check(s) failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`All public route smoke checks passed for ${baseUrl}`);

async function checkPwaManifest() {
  const manifestUrl = `${baseUrl}/manifest.webmanifest`;
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    failures += 1;
    console.error(`FAIL /manifest.webmanifest`);
    console.error(`  status: ${response.status}, expected: 200`);
    return;
  }

  let manifest;
  try {
    manifest = await response.json();
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
  const manifestIcons = new Set((manifest.icons || []).map((icon) => icon.src));
  const manifestScreenshots = new Set((manifest.screenshots || []).map((screenshot) => screenshot.src));
  const missingIcons = requiredIcons.filter((src) => !manifestIcons.has(src));
  const missingScreenshots = requiredScreenshots.filter((src) => !manifestScreenshots.has(src));

  if (
    manifest.name !== "TheTattooCore" ||
    manifest.short_name !== "TTC" ||
    missingFields.length > 0 ||
    missingIcons.length > 0 ||
    missingScreenshots.length > 0
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
    return;
  }

  const assetPaths = [...requiredIcons, ...requiredScreenshots];
  const missingAssets = [];

  for (const path of assetPaths) {
    const assetResponse = await fetch(`${baseUrl}${path}`, { method: "HEAD" });
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

async function checkSitemapUrls() {
  const response = await fetch(`${baseUrl}/sitemap.xml`);

  if (!response.ok) {
    failures += 1;
    console.error(`FAIL sitemap sample`);
    console.error(`  status: ${response.status}, expected: 200`);
    return;
  }

  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const badUrls = [];
  const publicUrls = [];

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

  const sampledUrls = publicUrls.slice(0, Number.isFinite(sitemapSampleLimit) ? sitemapSampleLimit : 25);
  const failedSamples = [];

  for (const url of sampledUrls) {
    const sampleResponse = await fetch(url, { redirect: "follow" });
    const body = await sampleResponse.text();
    const leakedText = forbiddenBodyText.filter((text) => body.includes(text));

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
