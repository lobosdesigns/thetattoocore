import { readFileSync } from "node:fs";

const generator = readFileSync("scripts/generate-private-release-handoff.mjs", "utf8");
const paymentReadiness = readFileSync("docs/PAYMENT_PRODUCTION_READINESS.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");

const requiredFlows = [
  "Merch checkout",
  "Booking deposit",
  "Ads checkout",
  "Seller payout readiness",
];

const requiredEvidenceColumns = [
  "Release candidate",
  "Expected mode checked",
  "Server key mode checked",
  "Webhook endpoint/events checked",
  "Admin reconciliation",
  "Refund/dispute/payout gate",
  "Penny/live-test proof",
  "Result",
];

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, message) {
  console.error(`FAIL ${label}`);
  if (message) console.error(`  ${message}`);
  process.exitCode = 1;
}

const paymentEvidenceSection = generator.slice(
  generator.indexOf("## Payment And Commerce Evidence"),
  generator.indexOf("## Payment Dashboard Readiness Log"),
);
const dashboardLogSection = generator.slice(
  generator.indexOf("## Payment Dashboard Readiness Log"),
  generator.indexOf("## Native Push Evidence"),
);
const readinessEvidenceSection = paymentReadiness.slice(
  paymentReadiness.indexOf("## Production Evidence Pack"),
  paymentReadiness.indexOf("## Draft Seller Payout Release Policy"),
);

if (
  packageJson.includes('"smoke:payment-cutover": "node scripts/smoke-payment-cutover-evidence.mjs"') &&
  packageJson.includes("npm run smoke:payments && npm run smoke:payment-cutover && npm run smoke:security")
) {
  pass("payment cutover guard is wired into payment release verification");
} else {
  fail("payment cutover guard is wired into payment release verification");
}

const missingColumns = requiredEvidenceColumns.filter(
  (column) => !paymentEvidenceSection.includes(column),
);
if (!missingColumns.length) {
  pass("private payment evidence matrix has required repo-safe columns");
} else {
  fail(
    "private payment evidence matrix has required repo-safe columns",
    `missing columns: ${missingColumns.join(", ")}`,
  );
}

const missingFlows = requiredFlows.filter((flow) => !paymentEvidenceSection.includes(`| ${flow} |`));
if (!missingFlows.length) {
  pass("private payment evidence matrix covers launch payment flows");
} else {
  fail(
    "private payment evidence matrix covers launch payment flows",
    `missing flows: ${missingFlows.join(", ")}`,
  );
}

if (
  paymentEvidenceSection.includes("| Seller payout readiness | pending | pending | pending | pending | pending | pending | n/a | pending |") &&
  dashboardLogSection.includes("| | Live-money proof | Penny test, Admin reconciliation, refund/dispute procedure, payout gate, and native checkout policy review | pending | | |")
) {
  pass("private handoff keeps payout and live-money proof blocked until reviewed");
} else {
  fail("private handoff keeps payout and live-money proof blocked until reviewed");
}

const requiredReadinessText = [
  "Repo-safe summary fields are limited to release candidate, test flow, live/test mode result",
  "Keep payment intent IDs, checkout session IDs, webhook event IDs, refund IDs, dispute IDs, seller account IDs",
  "`pending`, `passed`, or `blocked`; no payment IDs",
  "Each flow must be verified against the same release candidate",
];
const missingReadinessText = requiredReadinessText.filter(
  (snippet) => !readinessEvidenceSection.includes(snippet),
);
if (!missingReadinessText.length) {
  pass("payment readiness docs keep repo-safe cutover evidence boundaries explicit");
} else {
  fail(
    "payment readiness docs keep repo-safe cutover evidence boundaries explicit",
    `missing text: ${missingReadinessText.join(" | ")}`,
  );
}

const forbiddenUnboundedRequests = [
  "store payment IDs",
  "store dashboard screenshots",
  "store buyer addresses",
  "store seller account details",
  "store bank details",
  "store card details",
  "store webhook secrets",
  "store raw exports",
];
const forbiddenHits = forbiddenUnboundedRequests.filter((snippet) =>
  paymentReadiness.toLowerCase().includes(snippet),
);
if (!forbiddenHits.length) {
  pass("payment cutover evidence avoids requesting sensitive identifiers in repo docs");
} else {
  fail(
    "payment cutover evidence avoids requesting sensitive identifiers in repo docs",
    `sensitive evidence requested in repo docs: ${forbiddenHits.join(", ")}`,
  );
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
