import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const gatePath = "scripts/smoke-payment-cutover-evidence.mjs";
const fixturePath = "scripts/fixtures/payment-go-live-evidence.passed.md";
const fixtureCandidate = "0123456789abcdef0123456789abcdef01234567";
const unsafeFixtureCandidate = "1111111111111111111111111111111111111111";
const fixtureReferenceDate = "2026-07-23";
const safeCandidateSourceFixture =
  "scripts/fixtures/payment-candidate-source.safe.json";
const unsafeCandidateSourceFixture =
  "scripts/fixtures/payment-candidate-source.unsafe.json";
const merchCheckoutSourcePath = "src/app/api/merch/checkout/route.ts";
const fixtureSource = readFileSync(fixturePath, "utf8");
const safeCandidateSource = JSON.parse(
  readFileSync(safeCandidateSourceFixture, "utf8"),
);
const variantDir = mkdtempSync(
  join("scripts", "fixtures", ".payment-go-live-test-"),
);

function writeVariant(name, from, to) {
  const source = fixtureSource.replaceAll(from, to);

  if (source === fixtureSource) {
    throw new Error(`Fixture variant ${name} did not change the source.`);
  }

  return writeSource(name, source);
}

function writeSource(name, source) {
  const path = join(variantDir, name);
  writeFileSync(path, source);
  return path;
}

function writeCandidateSourceVariant(name, mutateRouteLines) {
  const source = structuredClone(safeCandidateSource);
  const routeLines = source.sources[merchCheckoutSourcePath];
  const originalRoute = routeLines.join("\n");
  mutateRouteLines(routeLines);
  if (routeLines.join("\n") === originalRoute) {
    throw new Error(`Candidate source variant ${name} did not change the route.`);
  }
  return writeSource(name, `${JSON.stringify(source, null, 2)}\n`);
}

const staleFixture = writeVariant(
  "stale-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "2026-05-01T12:00:00Z",
);
const futureFixture = writeVariant(
  "future-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "2026-07-24T12:00:00Z",
);
const ambiguousFixture = writeVariant(
  "ambiguous-dashboard-date.md",
  "2026-07-22T12:00:00Z",
  "07/22/2026 12:00",
);
const armedExcludedMarketplaceFixture = writeVariant(
  "armed-excluded-marketplace.md",
  "| Marketplace Merch checkout | 0123456789abcdef0123456789abcdef01234567 | blocked | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
  "| Marketplace Merch checkout | 0123456789abcdef0123456789abcdef01234567 | armed | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
);
const missingExcludedGateProofFixture = writeVariant(
  "missing-excluded-gate-proof.md",
  "| Booking deposit | 0123456789abcdef0123456789abcdef01234567 | blocked | fixture-only | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
  "| Booking deposit | 0123456789abcdef0123456789abcdef01234567 | blocked | | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
);
const pendingAppleNativePolicyFixture = writeVariant(
  "pending-apple-native-policy.md",
  "| Apple | Native physical-goods classification and review evidence | Sanitized exact-build reviewer-note fixture proof | passed | fixture-only |",
  "| Apple | Native physical-goods classification and review evidence | Exact-build reviewer note still required | pending | |",
);
const pendingGoogleNativePolicyFixture = writeVariant(
  "pending-google-native-policy.md",
  "| Google Play | Native physical-goods classification and review evidence | Sanitized exact-build classification fixture proof | passed | fixture-only |",
  "| Google Play | Native physical-goods classification and review evidence | Exact-build classification still required | pending | |",
);
const unsafeCandidateEvidenceFixture = writeSource(
  "unsafe-candidate-evidence.md",
  fixtureSource.replaceAll(fixtureCandidate, unsafeFixtureCandidate),
);
const lateOfficialRejectionSourceFixture = writeCandidateSourceVariant(
  "late-official-rejection-source.json",
  (routeLines) => {
    const rejectionIndex = routeLines.indexOf(
      "  if (product.is_official && product.shipping_required !== true) {",
    );
    const rejection = routeLines.splice(rejectionIndex, 3);
    const adminIndex = routeLines.indexOf(
      "  const adminSupabase = createAdminClient();",
    );
    routeLines.splice(adminIndex + 1, 0, ...rejection);
  },
);
const conditionalOfficialRejectionSourceFixture = writeCandidateSourceVariant(
  "conditional-official-rejection-source.json",
  (routeLines) => {
    const returnIndex = routeLines.indexOf(
      "    return redirectWithMessage();",
      routeLines.indexOf(
        "  if (product.is_official && product.shipping_required !== true) {",
      ),
    );
    routeLines.splice(
      returnIndex,
      1,
      "    if (shouldBlockOfficialProduct) {",
      "      return redirectWithMessage();",
      "    }",
    );
  },
);
const wrongOfficialCountrySourceFixture = writeCandidateSourceVariant(
  "wrong-official-country-source.json",
  (routeLines) => {
    const countryIndex = routeLines.indexOf(
      '    body.set("shipping_address_collection[allowed_countries][0]", "US");',
    );
    routeLines[countryIndex] =
      '    body.set("shipping_address_collection[allowed_countries][0]", "CA");';
  },
);
const missingMarketplaceCountrySourceFixture = writeCandidateSourceVariant(
  "missing-marketplace-country-source.json",
  (routeLines) => {
    const countryIndex = routeLines.indexOf(
      '      body.set("shipping_address_collection[allowed_countries][1]", "CA");',
    );
    routeLines[countryIndex] = "      void product.is_official;";
  },
);
const missingMarketplaceGateSourceFixture = writeCandidateSourceVariant(
  "missing-marketplace-gate-source.json",
  (routeLines) => {
    const gateIndex = routeLines.indexOf(
      "    if (!stripeMerchDestinationChargesEnabled()) return redirectWithMessage();",
    );
    routeLines[gateIndex] = "    void stripeMerchDestinationChargesEnabled;";
  },
);
const lateMarketplaceGateSourceFixture = writeCandidateSourceVariant(
  "late-marketplace-gate-source.json",
  (routeLines) => {
    const gateStart = routeLines.indexOf("  if (!product.is_official) {");
    const gateEnd = routeLines.indexOf("  }", gateStart);
    const gate = routeLines.splice(gateStart, gateEnd - gateStart + 1);
    const checkoutIndex = routeLines.indexOf(
      "  return createCheckoutSession({ product });",
    );
    routeLines.splice(checkoutIndex, 0, ...gate);
  },
);
const completedProductionEvidenceFixture = writeSource(
  "completed-production-evidence.md",
  fixtureSource
    .replace(
      "| Official TTC Merch checkout | 0123456789abcdef0123456789abcdef01234567 | armed | fixture-only | passed | passed | passed | passed | passed | pending | passed |",
      "| Official TTC Merch checkout | 0123456789abcdef0123456789abcdef01234567 | enabled | fixture-only | passed | passed | passed | passed | passed | passed | passed |",
    )
    .replace(
      "| | Post-transaction production proof | Recorded only after a genuine authorized sale | pending | | fixture |",
      "| 2026-07-22T12:00:00Z | Post-transaction production proof | Sanitized fixture proof | passed | fixture-only | fixture |",
    ),
);

function runGate(
  evidencePath,
  releaseCandidate = fixtureCandidate,
  phase = "preauthorization",
  candidateSourceFixture = safeCandidateSourceFixture,
) {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--phase",
      phase,
      "--test-fixture",
      "--candidate-source-fixture",
      candidateSourceFixture,
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      evidencePath,
      "--release-candidate",
      releaseCandidate,
    ],
    { encoding: "utf8" },
  );
}

function runProductionClockOverride() {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--reference-date",
      fixtureReferenceDate,
      "--evidence",
      fixturePath,
      "--release-candidate",
      fixtureCandidate,
    ],
    { encoding: "utf8" },
  );
}

function runProductionUnknownCandidate() {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--evidence",
      fixturePath,
      "--release-candidate",
      "0000000000000000000000000000000000000000",
    ],
    { encoding: "utf8" },
  );
}

function runProductionCandidateSourceFixture() {
  return spawnSync(
    process.execPath,
    [
      gatePath,
      "--strict",
      "--candidate-source-fixture",
      safeCandidateSourceFixture,
      "--evidence",
      fixturePath,
      "--release-candidate",
      fixtureCandidate,
    ],
    { encoding: "utf8" },
  );
}

const checks = [
  {
    label: "payment gate accepts an f272f0a0-equivalent safe candidate fixture",
    result: runGate(fixturePath),
    verify(result) {
      return (
        result.status === 0 &&
        result.stdout.includes(
          "PASS sanitized payment go-live fixture validates strict gate",
        )
      );
    },
  },
  {
    label: "payment gate rejects stale dashboard evidence",
    result: runGate(staleFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("date must be within 45 days")
      );
    },
  },
  {
    label: "payment gate rejects future dashboard evidence",
    result: runGate(futureFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("date cannot be in the future")
      );
    },
  },
  {
    label: "payment gate rejects ambiguous dashboard dates",
    result: runGate(ambiguousFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("Attempt date/time: invalid date")
      );
    },
  },
  {
    label: "payment gate rejects n/a evidence for an armed excluded flow",
    result: runGate(armedExcludedMarketplaceFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Marketplace Merch checkout / Release switch state: must be exactly blocked while the flow is excluded",
        )
      );
    },
  },
  {
    label: "payment gate rejects excluded n/a without private blocked-state proof",
    result: runGate(missingExcludedGateProofFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Booking deposit / Private gate proof filename or location: missing",
        )
      );
    },
  },
  {
    label: "payment preauthorization rejects pending Apple native physical-goods evidence",
    result: runGate(pendingAppleNativePolicyFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Apple blocker / Native physical-goods classification and review evidence / Result: pending",
        )
      );
    },
  },
  {
    label: "payment preauthorization rejects pending Google Play native physical-goods evidence",
    result: runGate(pendingGoogleNativePolicyFixture),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Google Play blocker / Native physical-goods classification and review evidence / Result: pending",
        )
      );
    },
  },
  {
    label: "payment gate rejects a d8e05bc-equivalent candidate from its selected source fixture",
    result: runGate(
      unsafeCandidateEvidenceFixture,
      unsafeFixtureCandidate,
      "preauthorization",
      unsafeCandidateSourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Official non-shipping products must be rejected",
        )
      );
    },
  },
  {
    label: "candidate proof requires official rejection before admin and checkout effects",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      lateOfficialRejectionSourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Official product rejection must precede admin client creation and checkout side effects",
        )
      );
    },
  },
  {
    label: "candidate proof rejects a conditional nested official return",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      conditionalOfficialRejectionSourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Official non-shipping products must be rejected",
        )
      );
    },
  },
  {
    label: "candidate proof requires official physical shipping to be exactly US",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      wrongOfficialCountrySourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Official physical shipping countries must be exactly US",
        )
      );
    },
  },
  {
    label: "candidate proof requires marketplace physical shipping to remain US and CA",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      missingMarketplaceCountrySourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Marketplace physical shipping countries must remain exactly US and CA",
        )
      );
    },
  },
  {
    label: "candidate proof requires the independent marketplace destination gate",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      missingMarketplaceGateSourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Marketplace physical checkout must retain independent checkout and destination-charge gates",
        )
      );
    },
  },
  {
    label: "candidate proof requires marketplace gates before checkout side effects",
    result: runGate(
      fixturePath,
      fixtureCandidate,
      "preauthorization",
      lateMarketplaceGateSourceFixture,
    ),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Candidate policy / Marketplace physical checkout must retain independent checkout and destination-charge gates",
        )
      );
    },
  },
  {
    label: "payment preauthorization does not require a production transaction",
    result: runGate(fixturePath),
    verify(result) {
      return result.status === 0;
    },
  },
  {
    label: "post-transaction evidence gate rejects pending production proof",
    result: runGate(fixturePath, fixtureCandidate, "post-transaction"),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes(
          "Payment flow / Official TTC Merch checkout / Post-transaction production proof: pending",
        )
      );
    },
  },
  {
    label: "post-transaction evidence gate accepts completed production proof",
    result: runGate(
      completedProductionEvidenceFixture,
      fixtureCandidate,
      "post-transaction",
    ),
    verify(result) {
      return result.status === 0;
    },
  },
  {
    label: "payment gate rejects symbolic release candidates",
    result: runGate(fixturePath, "latest"),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("must be a 7-40 character Git commit ID")
      );
    },
  },
  {
    label: "payment gate rejects unresolved production commits",
    result: runProductionUnknownCandidate(),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("does not resolve to a local Git commit")
      );
    },
  },
  {
    label: "payment gate rejects production clock overrides",
    result: runProductionClockOverride(),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("--reference-date: test fixtures only")
      );
    },
  },
  {
    label: "payment gate rejects candidate source fixtures outside test mode",
    result: runProductionCandidateSourceFixture(),
    verify(result) {
      return (
        result.status === 1 &&
        result.stderr.includes("--candidate-source-fixture: test fixtures only")
      );
    },
  },
];

let failures = 0;

for (const check of checks) {
  if (check.verify(check.result)) {
    console.log(`PASS ${check.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${check.label}`);
  }
}

rmSync(variantDir, { force: true, recursive: true });

if (failures > 0) {
  console.error(`${failures} payment go-live gate test(s) failed.`);
  process.exit(1);
}
