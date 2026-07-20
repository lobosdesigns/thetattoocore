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
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_EXPECTED_LIVEMODE",
  "HOSTGATOR_SMTP_PASSWORD",
];
const publicKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
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
