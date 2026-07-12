const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const forbiddenBodyText = [
  "This page couldn't load",
  "Reload to try again",
  "Application error",
  "Internal Server Error",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "lobosden@hotmail.com",
];

const checks = [
  { path: "/", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/account", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Faccount"], redirect: "manual" },
  { path: "/admin", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fadmin"], redirect: "manual" },
  { path: "/admin/payments", status: [307, 308], redirectIncludes: "/login", redirect: "manual" },
  { path: "/messages", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fmessages"], redirect: "manual" },
  { path: "/notifications", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fnotifications"], redirect: "manual" },
  { path: "/saved", status: [307, 308], redirectIncludes: "/login", locationIncludes: ["return_to=%2Fsaved"], redirect: "manual" },
  { path: "/login", status: [200], includes: ["Sign in or sign up", "TheTattooCore"] },
  { path: "/forgot-password", status: [200], includes: ["Reset password", "Send reset link"] },
  { path: "/reset-password", status: [200], includes: ["Create new password"] },
  { path: "/support", status: [200], includes: ["Support", "support@thetattoocore.com"] },
  { path: "/privacy", status: [200], includes: ["Privacy", "support@thetattoocore.com"] },
  { path: "/terms", status: [200], includes: ["Terms", "support@thetattoocore.com"] },
  { path: "/search", status: [200], includes: ["Search"] },
  { path: "/search?q=ceocore", status: [200], includes: ["CEOCore", "@ceocore"] },
  { path: "/search?q=ceocore&type=profiles", status: [200], includes: ["CEOCore", "@ceocore"] },
  { path: "/u/ceocore", status: [200], includes: ["CEOCore", "@ceocore"] },
  { path: "/merch/checkout/success", status: [200], includes: ["Checkout received", "Back to Merch"] },
  { path: "/robots.txt", status: [200], includes: ["User-agent"] },
  { path: "/sitemap.xml", status: [200], includes: ["urlset"] },
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
  const leakedText = forbiddenBodyText.filter((text) => body.includes(text));

  if (
    !okStatus ||
    !okRedirect ||
    missingLocationText.length > 0 ||
    missingText.length > 0 ||
    leakedText.length > 0
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
    if (missingLocationText.length > 0) {
      console.error(`  location: ${location || "(none)"}`);
      console.error(`  missing location text: ${missingLocationText.join(", ")}`);
    }
    if (leakedText.length > 0) {
      console.error(`  forbidden text present: ${leakedText.join(", ")}`);
    }
    continue;
  }

  console.log(`PASS ${check.path}`);
}

if (failures > 0) {
  console.error(`${failures} public route smoke check(s) failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`All public route smoke checks passed for ${baseUrl}`);
