import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const envExamplePath = ".env.example";
const gitignore = readFileSync(".gitignore", "utf8");
const envExample = readFileSync(envExamplePath, "utf8");
const readme = readFileSync("README.md", "utf8");
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
  {
    label: ".env.example exists and is the only committed env file",
    ok:
      existsSync(envExamplePath) &&
      gitignore.includes(".env*") &&
      gitignore.includes("!.env.example"),
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
    label: "README documents checkout mode fail-closed default",
    ok:
      readme.includes("STRIPE_EXPECTED_LIVEMODE") &&
      readme.includes("penny-test evidence"),
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
