import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const smokeSource = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
let failures = 0;

function check(label, assertion) {
  try {
    assertion();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

const homepageCheckStart = smokeSource.indexOf('    path: "/",');
const homepageCheckEnd = smokeSource.indexOf('  { path: "/account"', homepageCheckStart);
const homepageCheckSource = smokeSource.slice(homepageCheckStart, homepageCheckEnd);

check("homepage public smoke uses the evaluator's includes field", () => {
  assert.ok(homepageCheckStart >= 0 && homepageCheckEnd > homepageCheckStart);
  assert.match(homepageCheckSource, /\n    includes: \[/);
  assert.doesNotMatch(homepageCheckSource, /\n    textIncludes: \[/);
});

let support;
try {
  support = await import("./lib/public-smoke-support.mjs");
} catch (error) {
  failures += 1;
  console.error("FAIL public smoke support module loads");
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
}

if (support) {
  check("public smoke check validator accepts supported fields", () => {
    support.assertPublicSmokeChecks([{ includes: ["Public preview"], path: "/" }]);
  });

  check("public smoke check validator rejects the legacy text field", () => {
    assert.throws(
      () => support.assertPublicSmokeChecks([{ path: "/", textIncludes: ["Public preview"] }]),
      /unsupported "textIncludes".*use "includes"/,
    );
  });

  check("fetch failure diagnostics are useful and sanitized", () => {
    const error = new TypeError(
      "fetch failed for https://user:pass@example.invalid/path?token=secret sk_live_fixture",
      { cause: { code: "ETIMEDOUT" } },
    );
    const diagnostic = support.formatFetchFailureDiagnostic(error, 37);

    assert.match(diagnostic, /^TypeError: fetch failed for \[url\] \[redacted\]/);
    assert.match(diagnostic, /cause=ETIMEDOUT/);
    assert.match(diagnostic, /elapsed=37ms$/);
    assert.doesNotMatch(diagnostic, /example\.invalid|user:pass|sk_live_fixture/);
  });

  check("fetch failure diagnostics handle non-Error failures", () => {
    assert.equal(
      support.formatFetchFailureDiagnostic("connection closed", 0),
      "Error: connection closed; elapsed=0ms",
    );
  });

  check("public smoke validates route configuration before requests", () => {
    assert.match(smokeSource, /assertPublicSmokeChecks\(checks\);/);
  });
}

if (failures > 0) {
  console.error(`${failures} public smoke support test(s) failed.`);
  process.exit(1);
}

console.log("All public smoke support tests passed.");
