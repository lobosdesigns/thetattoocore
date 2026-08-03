import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const routeUrl = new URL("../src/app/api/merch/checkout/route.ts", import.meta.url);
const routeSource = await readFile(routeUrl, "utf8");
const successPageSource = await readFile(
  new URL("../src/app/merch/checkout/success/page.tsx", import.meta.url),
  "utf8",
);
const { POST } = await importSelfContainedTypeScript(routeUrl.href, import.meta.url);

async function assertMerchCheckoutUnavailable(request) {
  const response = await POST(request);

  assert.equal(response.status, 410);
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(await response.json(), {
    error: "Merch checkout is unavailable.",
  });
}

await assertMerchCheckoutUnavailable(
  new Request("https://thetattoocore.com/api/merch/checkout", {
    body: new FormData(),
    method: "POST",
  }),
);
console.log("PASS Merch checkout POST returns the fixed 410 boundary");

const hostileForm = new FormData();
hostileForm.set("product_id", "../../admin?<script>alert(1)</script>");
hostileForm.set("quantity", "999999999999999999999999");
hostileForm.set("return_to", "//evil.example/%0d%0aLocation:%20https://evil.example");
hostileForm.set("session_id", "cs_live_secret-shaped-input");

await assertMerchCheckoutUnavailable(
  new Request(
    "https://thetattoocore.com/api/merch/checkout?redirect=https%3A%2F%2Fevil.example&session_id=cs_live_query_secret",
    {
      body: hostileForm,
      headers: {
        authorization: "Bearer attacker-controlled-secret",
        cookie: "session=attacker-controlled-cookie",
        "x-forwarded-host": "evil.example",
      },
      method: "POST",
    },
  ),
);
console.log("PASS hostile request input cannot alter or leak through the fixed 410 response");

const forbiddenRouteReferences = [
  ["imports", /^\s*import\b/m],
  ["Stripe", /stripe/i],
  ["Supabase", /supabase/i],
  ["fees", /\bfees?\b/i],
  ["inventory reservations", /inventory[_\s-]?reserv/i],
  ["merch_orders", /merch_orders/i],
  ["Checkout Sessions", /checkout[_\s.-]?sessions?/i],
  ["PaymentIntents", /payment[_\s.-]?intents?/i],
  ["application fees", /application[_\s.-]?fees?/i],
  ["transfers", /\btransfers?\b/i],
  ["redirects", /redirect/i],
  ["authentication", /\b(?:auth|getClaims)\b/i],
  ["cache revalidation", /revalidate/i],
  ["URL helpers", /\b(?:URL|URLSearchParams)\b/],
  ["navigation helpers", /\b(?:NextResponse|navigation)\b/i],
];

for (const [label, pattern] of forbiddenRouteReferences) {
  assert.doesNotMatch(routeSource, pattern, `Merch checkout route must not reference ${label}`);
}
console.log("PASS Merch checkout tombstone has no payment, database, cache, URL, or navigation dependencies");

assert.match(successPageSource, /sessionId && claims\?\.sub/);
assert.match(successPageSource, /\.eq\("stripe_checkout_session_id", sessionId\)/);
assert.match(successPageSource, /\.eq\("buyer_id", claims\.sub\)/);
assert.match(
  successPageSource,
  /const copy = order\s*\?\s*statusCopy\(order\.status\)\s*:\s*\{\s*heading: "No TTC order was found",\s*message:\s*"Seller-owned checkout purchases are confirmed and supported by the seller using the seller's receipt\."/s,
);
assert.doesNotMatch(successPageSource, /statusCopy\(order\?\.status\)/);
assert.match(
  successPageSource,
  /\{order \? \(\s*<CheckCircle2[\s\S]*?\) : \(\s*<Package/,
);
assert.match(successPageSource, /\{order \? <PrintReceiptButton \/> : null\}/);
console.log("PASS no-row receipt state cannot claim TTC checkout success");
