import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const envExamplePath = ".env.example";
const gitignore = readFileSync(".gitignore", "utf8");
const envExample = readFileSync(envExamplePath, "utf8");
const readme = readFileSync("README.md", "utf8");
const environmentInventory = readFileSync(
  "docs/release/v1.1.0-environment-inventory.md",
  "utf8",
);
const wranglerConfig = readFileSync("wrangler.jsonc", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const browserClient = readFileSync("src/lib/supabase/client.ts", "utf8");
const publicBuildVerifier = readFileSync(
  "scripts/verify-public-build-env.mjs",
  "utf8",
);
const publicBuildEnv = readFileSync(
  "scripts/lib/public-build-env.mjs",
  "utf8",
);
const publicBuildTest = readFileSync(
  "scripts/test-public-build-env.mjs",
  "utf8",
);
const lines = envExample
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const expectedKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED",
  "TTC_DEVICE_ALERT_SETUP_ENABLED",
  "TTC_NATIVE_PUSH_REGISTRATION_ENABLED",
  "TTC_NATIVE_PUSH_DELIVERY_ENABLED",
  "TTC_WEB_PUSH_REGISTRATION_ENABLED",
  "TTC_SELLER_CHECKOUT_LINKS_ENABLED",
  "TTC_ANDROID_APP_LINK_PACKAGE_NAME",
  "TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS",
  "TTC_IOS_APP_LINK_APP_IDS",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_EXPECTED_LIVEMODE",
  "STRIPE_CHECKOUT_CREATION_ENABLED",
  "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
  "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  "STRIPE_BOOKING_CHECKOUT_ENABLED",
  "STRIPE_CONNECT_ONBOARDING_ENABLED",
  "STRIPE_MERCH_DESTINATION_CHARGES_ENABLED",
  "HOSTGATOR_SMTP_PASSWORD",
];
const publicKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED",
];
const secretKeys = expectedKeys.filter((key) => !publicKeys.includes(key));
const stripeReleaseSwitchKeys = [
  "STRIPE_CHECKOUT_CREATION_ENABLED",
  "STRIPE_OFFICIAL_MERCH_CHECKOUT_ENABLED",
  "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED",
  "STRIPE_BOOKING_CHECKOUT_ENABLED",
  "STRIPE_CONNECT_ONBOARDING_ENABLED",
];
const retiredTtcPaymentSwitchKeys = [
  ...stripeReleaseSwitchKeys,
  "STRIPE_MERCH_DESTINATION_CHARGES_ENABLED",
];
const pairs = lines.map((line) => {
  const separatorIndex = line.indexOf("=");

  return {
    key: separatorIndex === -1 ? line : line.slice(0, separatorIndex),
    value: separatorIndex === -1 ? "" : line.slice(separatorIndex + 1),
  };
});
const valueByKey = new Map(pairs.map(({ key, value }) => [key, value]));

function hasOnlyExpectedKeys() {
  const actualKeys = pairs.map(({ key }) => key);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => actualKeys[index] === key)
  );
}

function describeKeyOrderIssue() {
  const actualKeys = pairs.map(({ key }) => key);
  const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
  const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key));
  const outOfOrderKeys = expectedKeys.filter((key, index) => actualKeys[index] !== key);
  const issues = [];

  if (missingKeys.length > 0) issues.push(`missing: ${missingKeys.join(", ")}`);
  if (extraKeys.length > 0) issues.push(`unexpected: ${extraKeys.join(", ")}`);
  if (outOfOrderKeys.length > 0) issues.push(`order mismatch near: ${outOfOrderKeys[0]}`);

  return issues.join("; ");
}

function keysWithNonPlaceholderSecretValues() {
  return secretKeys.filter((key) => !valueLooksLikePlaceholder(key, valueByKey.get(key) ?? ""));
}

function valueLooksLikePlaceholder(key, value) {
  if (key === "NEXT_PUBLIC_SITE_URL") {
    return value === "https://thetattoocore.com";
  }

  if (key === "STRIPE_EXPECTED_LIVEMODE") {
    return value === "false";
  }

  if (
    key === "NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED" ||
    key === "TTC_DEVICE_ALERT_SETUP_ENABLED" ||
    key === "TTC_NATIVE_PUSH_REGISTRATION_ENABLED" ||
    key === "TTC_NATIVE_PUSH_DELIVERY_ENABLED" ||
    key === "TTC_WEB_PUSH_REGISTRATION_ENABLED" ||
    key === "TTC_SELLER_CHECKOUT_LINKS_ENABLED" ||
    stripeReleaseSwitchKeys.includes(key) ||
    key === "STRIPE_MERCH_DESTINATION_CHARGES_ENABLED"
  ) {
    return value === "false";
  }

  if (key === "TTC_ANDROID_APP_LINK_PACKAGE_NAME") {
    return value === "com.thetattoocore.app";
  }

  if (
    key === "TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS" ||
    key === "TTC_IOS_APP_LINK_APP_IDS"
  ) {
    return value.startsWith("replace_with_");
  }

  return /replace_|_key|_secret|server_only|sk_test_or_live|whsec_from|when_ready/.test(value);
}

const secretValuePatterns = [
  { label: "backend secret key", pattern: /sb_secret_/i },
  { label: "public backend key", pattern: /sb_publishable_[A-Za-z0-9_-]{20,}/ },
  {
    label: "JWT-like token",
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  },
  { label: "live payment secret key", pattern: /sk_live_[A-Za-z0-9]{12,}/ },
  { label: "test payment secret key", pattern: /sk_test_[A-Za-z0-9]{12,}/ },
  { label: "webhook signing secret", pattern: /whsec_[A-Za-z0-9]{12,}/ },
];

function liveLookingSecretPatternLabels() {
  return secretValuePatterns
    .filter(({ pattern }) => pattern.test(envExample))
    .map(({ label }) => label);
}

function parseJsonc(source) {
  let index = 0;

  function fail(message) {
    throw new Error(`${message} at character ${index}`);
  }

  function skipTrivia() {
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index += 1;
        continue;
      }

      if (source.startsWith("//", index)) {
        const lineEnd = source.indexOf("\n", index + 2);
        index = lineEnd === -1 ? source.length : lineEnd + 1;
        continue;
      }

      if (source.startsWith("/*", index)) {
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1) fail("Unterminated JSONC comment");
        index = commentEnd + 2;
        continue;
      }

      break;
    }
  }

  function parseString() {
    const start = index;
    index += 1;

    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
        continue;
      }

      if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index));
      }

      index += 1;
    }

    fail("Unterminated JSONC string");
  }

  function parseArray() {
    const items = [];
    index += 1;
    skipTrivia();

    if (source[index] === "]") {
      index += 1;
      return { type: "array", items };
    }

    while (index < source.length) {
      items.push(parseValue());
      skipTrivia();

      if (source[index] === "]") {
        index += 1;
        return { type: "array", items };
      }

      if (source[index] !== ",") fail("Expected a comma in JSONC array");
      index += 1;
      skipTrivia();

      if (source[index] === "]") {
        index += 1;
        return { type: "array", items };
      }
    }

    fail("Unterminated JSONC array");
  }

  function parseObject() {
    const entries = [];
    index += 1;
    skipTrivia();

    if (source[index] === "}") {
      index += 1;
      return { type: "object", entries };
    }

    while (index < source.length) {
      if (source[index] !== '"') fail("Expected a JSONC object key");
      const key = parseString();
      skipTrivia();

      if (source[index] !== ":") fail("Expected a colon after JSONC object key");
      index += 1;
      const value = parseValue();
      entries.push({ key, value });
      skipTrivia();

      if (source[index] === "}") {
        index += 1;
        return { type: "object", entries };
      }

      if (source[index] !== ",") fail("Expected a comma in JSONC object");
      index += 1;
      skipTrivia();

      if (source[index] === "}") {
        index += 1;
        return { type: "object", entries };
      }
    }

    fail("Unterminated JSONC object");
  }

  function parseValue() {
    skipTrivia();

    if (source[index] === "{") return parseObject();
    if (source[index] === "[") return parseArray();
    if (source[index] === '"') {
      return { type: "scalar", value: parseString() };
    }

    const start = index;
    while (index < source.length && !/[\s,}\]]/.test(source[index])) {
      index += 1;
    }

    if (start === index) fail("Expected a JSONC value");
    return {
      type: "scalar",
      value: JSON.parse(source.slice(start, index)),
    };
  }

  const root = parseValue();
  skipTrivia();
  if (index !== source.length) fail("Unexpected JSONC content");
  return root;
}

function wranglerPaymentConfigSafety(source) {
  const issues = [];
  let root;

  try {
    root = parseJsonc(source);
  } catch (error) {
    return {
      issues: [`wrangler JSONC parse failed: ${error instanceof Error ? error.message : "unknown error"}`],
      ok: false,
    };
  }

  if (root.type !== "object") {
    return { issues: ["wrangler root must be an object"], ok: false };
  }

  const varsEntries = root.entries.filter(({ key }) => key === "vars");
  if (varsEntries.length !== 1 || varsEntries[0].value.type !== "object") {
    return { issues: ["wrangler vars must be one object"], ok: false };
  }

  const vars = varsEntries[0].value.entries;
  const valuesFor = (key) =>
    vars.filter((entry) => entry.key === key).map((entry) => entry.value);
  const requiresOneFalseString = (key) => {
    const values = valuesFor(key);
    if (
      values.length !== 1 ||
      values[0].type !== "scalar" ||
      values[0].value !== "false"
    ) {
      issues.push(`${key} must appear exactly once with string value false`);
    }
  };

  requiresOneFalseString("TTC_SELLER_CHECKOUT_LINKS_ENABLED");
  requiresOneFalseString("TTC_NATIVE_PUSH_DELIVERY_ENABLED");

  for (const key of retiredTtcPaymentSwitchKeys) {
    const values = valuesFor(key);
    if (
      values.length > 1 ||
      (values.length === 1 &&
        (values[0].type !== "scalar" || values[0].value !== "false"))
    ) {
      issues.push(`${key} must be absent or appear once with string value false`);
    }
  }

  return { issues, ok: issues.length === 0 };
}

function wranglerPaymentConfigLooksSafe(source) {
  return wranglerPaymentConfigSafety(source).ok;
}

function appendWranglerVar(source, entry) {
  return source.replace(
    '"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "false"',
    `"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "false",\n    ${entry}`,
  );
}

const wranglerGuardMutationCases = [
  {
    label: "wrangler parser rejects duplicate seller checkout keys",
    source: appendWranglerVar(
      wranglerConfig,
      '"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "false"',
    ),
  },
  {
    label: "wrangler parser rejects seller checkout enablement",
    source: wranglerConfig.replace(
      '"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "false"',
      '"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "true"',
    ),
  },
  {
    label: "wrangler parser rejects native push delivery enablement",
    source: wranglerConfig.replace(
      '"TTC_NATIVE_PUSH_DELIVERY_ENABLED": "false"',
      '"TTC_NATIVE_PUSH_DELIVERY_ENABLED": "true"',
    ),
  },
  ...retiredTtcPaymentSwitchKeys.map((key) => ({
    label: `wrangler parser rejects retired ${key} enablement`,
    source: appendWranglerVar(wranglerConfig, `"${key}": "true"`),
  })),
];
const wranglerPaymentConfig = wranglerPaymentConfigSafety(wranglerConfig);

const liveLookingSecretLabels = liveLookingSecretPatternLabels();
const nativeSigningKeys = [
  "TTC_ANDROID_UPLOAD_STORE_FILE",
  "TTC_ANDROID_UPLOAD_STORE_PASSWORD",
  "TTC_ANDROID_UPLOAD_KEY_ALIAS",
  "TTC_ANDROID_UPLOAD_KEY_PASSWORD",
];
const forbiddenNativeArtifactNames = ["google-services.json", "GoogleService-Info.plist"];
const forbiddenNativeArtifactExtensions = [".jks", ".keystore"];

const trackedNativePaths = execFileSync("git", ["ls-files", "native"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .map((path) => path.trim())
  .filter(Boolean);
const committedNativeArtifactPaths = trackedNativePaths.filter((path) => {
  const fileName = path.split("/").at(-1) ?? "";

  return (
    forbiddenNativeArtifactNames.includes(fileName) ||
    forbiddenNativeArtifactExtensions.some((extension) => path.endsWith(extension)) ||
    path.includes("/keystores/")
  );
});

const checks = [
  ...wranglerGuardMutationCases.map(({ label, source }) => ({
    label,
    ok: !wranglerPaymentConfigLooksSafe(source),
  })),
  {
    label: "seller checkout release gate is exact false in repo-safe config",
    ok:
      valueByKey.get("TTC_SELLER_CHECKOUT_LINKS_ENABLED") === "false" &&
      wranglerPaymentConfig.ok &&
      wranglerConfig.includes('"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "false"') &&
      !envExample.includes("TTC_SELLER_CHECKOUT_LINKS_ENABLED=true") &&
      !wranglerConfig.includes('"TTC_SELLER_CHECKOUT_LINKS_ENABLED": "true"') &&
      readme.includes("`TTC_SELLER_CHECKOUT_LINKS_ENABLED`: optional server release gate; keep `false` by default") &&
      environmentInventory.includes("`TTC_SELLER_CHECKOUT_LINKS_ENABLED`") &&
      environmentInventory.includes("Optional server release gate") &&
      environmentInventory.includes("Defaults to `false`") &&
      !/https:\/\/buy[.]stripe[.]com\//i.test(environmentInventory) &&
      !/\bacct_[A-Za-z0-9]+\b/.test(environmentInventory),
    message: wranglerPaymentConfig.issues.join("; "),
  },
  {
    label: ".env.example exists and is the only committed env file",
    ok:
      existsSync(envExamplePath) &&
      gitignore.includes(".env*") &&
      gitignore.includes("!.env.example"),
  },
  {
    label: "public browser configuration fails closed before production builds",
    ok:
      packageJson.includes(
        '"prebuild": "node scripts/verify-public-build-env.mjs"',
      ) &&
      packageJson.includes(
        '"test:public-build-env": "node scripts/test-public-build-env.mjs"',
      ) &&
      publicBuildVerifier.includes('import nextEnv from "@next/env"') &&
      publicBuildVerifier.includes("const { loadEnvConfig } = nextEnv") &&
      publicBuildVerifier.includes("loadEnvConfig(process.cwd())") &&
      publicBuildVerifier.includes("publicBuildEnvIsValid(process.env)") &&
      publicBuildEnv.includes("url.protocol === \"https:\"") &&
      publicBuildEnv.includes(
        "/^sb_publishable_[A-Za-z0-9_-]{20,}$/",
      ) &&
      publicBuildTest.includes("missing public URL") &&
      publicBuildTest.includes("missing publishable key") &&
      publicBuildTest.includes("malformed public URL") &&
      publicBuildTest.includes("secret key in public configuration") &&
      browserClient.includes(
        "const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;",
      ) &&
      browserClient.includes(
        "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;",
      ) &&
      browserClient.includes(
        'throw new Error("Public app configuration is unavailable.");',
      ) &&
      !browserClient.includes("??") &&
      !browserClient.includes("ytznkgcslezijkehwjsj") &&
      !browserClient.includes("sb_publishable_8hTy3"),
  },
  {
    label: "native app provider config files stay out of git",
    ok:
      gitignore.includes("**/google-services.json") &&
      gitignore.includes("**/GoogleService-Info.plist"),
  },
  {
    label: "native signing and app config artifacts are absent from repo",
    ok:
      committedNativeArtifactPaths.length === 0 &&
      gitignore.includes("**/keystores/") &&
      gitignore.includes("**/*.jks") &&
      gitignore.includes("**/*.keystore"),
    message: `private native artifacts found: ${committedNativeArtifactPaths.join(", ")}`,
  },
  {
    label: "native signing inputs stay private and out of .env.example",
    ok:
      nativeSigningKeys.every((key) => !envExample.includes(key)) &&
      nativeSigningKeys.every((key) => readme.includes(key)) &&
      readme.includes("Android upload signing values are private native-build inputs") &&
      readme.includes("They do not belong in `.env.example`") &&
      readme.includes("Keep `google-services.json`") &&
      readme.includes("`GoogleService-Info.plist` out of git"),
  },
  {
    label: ".env.example has the required production keys in stable order",
    ok: hasOnlyExpectedKeys(),
    message: describeKeyOrderIssue(),
  },
  {
    label: ".env.example keeps public and server-only keys separated",
    ok:
      publicKeys.every((key) => key.startsWith("NEXT_PUBLIC_")) &&
      secretKeys.every((key) => !key.startsWith("NEXT_PUBLIC_")),
  },
  {
    label: ".env.example keeps secret values as placeholders",
    ok: secretKeys.every((key) => valueLooksLikePlaceholder(key, valueByKey.get(key) ?? "")),
    message: `non-placeholder secret keys: ${keysWithNonPlaceholderSecretValues().join(", ")}`,
  },
  {
    label: ".env.example keeps browser push gated behind a placeholder public key",
    ok:
      valueByKey.get("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") ===
      "replace_with_web_push_public_key_when_ready",
  },
  {
    label: ".env.example keeps device alert setup behind an explicit off switch",
    ok:
      valueByKey.get("NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED") === "false" &&
      valueByKey.get("TTC_DEVICE_ALERT_SETUP_ENABLED") === "false" &&
      valueByKey.get("TTC_NATIVE_PUSH_REGISTRATION_ENABLED") === "false" &&
      valueByKey.get("TTC_NATIVE_PUSH_DELIVERY_ENABLED") === "false" &&
      valueByKey.get("TTC_WEB_PUSH_REGISTRATION_ENABLED") === "false",
  },
  {
    label: ".env.example keeps app-link association identifiers as placeholders",
    ok:
      valueByKey.get("TTC_ANDROID_APP_LINK_PACKAGE_NAME") === "com.thetattoocore.app" &&
      valueByKey.get("TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS") ===
        "replace_with_google_play_app_signing_sha256_fingerprints" &&
      valueByKey.get("TTC_IOS_APP_LINK_APP_IDS") ===
        "replace_with_apple_team_id_dot_bundle_id",
  },
  {
    label: ".env.example does not contain live-looking secret material",
    ok: liveLookingSecretLabels.length === 0,
    message: `live-looking secret pattern categories: ${liveLookingSecretLabels.join(", ")}`,
  },
  {
    label: ".env.example documents checkout mode fail-closed default",
    ok: valueByKey.get("STRIPE_EXPECTED_LIVEMODE") === "false",
  },
  {
    label: ".env.example keeps Stripe release switches false in stable order",
    ok: stripeReleaseSwitchKeys.every(
      (key) => valueByKey.get(key) === "false",
    ),
  },
  {
    label: "Stripe release switches remain server-only and fail closed in operator guidance",
    ok:
      stripeReleaseSwitchKeys.every((key) => readme.includes(`\`${key}\``)) &&
      readme.includes("server-only release switches") &&
      readme.includes("exactly `true`") &&
      stripeReleaseSwitchKeys.every(
        (key) =>
          environmentInventory.includes(`| \`${key}\``) &&
          environmentInventory.includes(`${key}\` | Optional release gate | Worker/server | No | Defaults to \`false\``),
      ),
  },
  {
    label: "README documents checkout mode fail-closed default",
    ok:
      readme.includes("STRIPE_EXPECTED_LIVEMODE") &&
      readme.includes("separate dark-staging approval"),
  },
  {
    label: "README documents private app-link association deployment inputs",
    ok:
      readme.includes("TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS") &&
      readme.includes("TTC_IOS_APP_LINK_APP_IDS") &&
      readme.includes("The `.well-known` association routes stay unavailable") &&
      readme.includes("configured privately"),
  },
  {
    label: "README documents device alert setup fail-closed default",
    ok:
      readme.includes("NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED") &&
      readme.includes("TTC_DEVICE_ALERT_SETUP_ENABLED") &&
      readme.includes("TTC_NATIVE_PUSH_REGISTRATION_ENABLED") &&
      readme.includes("TTC_NATIVE_PUSH_DELIVERY_ENABLED") &&
      readme.includes("TTC_WEB_PUSH_REGISTRATION_ENABLED") &&
      readme.includes("keep `false` until device-alert delivery") &&
      readme.includes("tap routing, opt-out, quiet hours, and category preference evidence"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  for (const check of failures) {
    if (check.message) {
      console.error(`  ${check.message}`);
    }
  }
  console.error(`${failures.length} env guard smoke check(s) failed.`);
  process.exit(1);
}
