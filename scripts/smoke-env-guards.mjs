import { existsSync, readFileSync } from "node:fs";

const envExamplePath = ".env.example";
const gitignore = readFileSync(".gitignore", "utf8");
const envExample = readFileSync(envExamplePath, "utf8");
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
  /sb_secret_/i,
  /sb_publishable_[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /sk_live_[A-Za-z0-9]{12,}/,
  /sk_test_[A-Za-z0-9]{12,}/,
  /whsec_[A-Za-z0-9]{12,}/,
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
    label: ".env.example has the required production keys in stable order",
    ok: hasOnlyExpectedKeys(),
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
  },
  {
    label: ".env.example keeps browser push gated behind a placeholder public key",
    ok:
      valueByKey.get("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") ===
      "replace_with_web_push_public_key_when_ready",
  },
  {
    label: ".env.example does not contain live-looking secret material",
    ok: secretValuePatterns.every((pattern) => !pattern.test(envExample)),
  },
  {
    label: ".env.example documents checkout mode fail-closed default",
    ok: valueByKey.get("STRIPE_EXPECTED_LIVEMODE") === "false",
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} env guard smoke check(s) failed.`);
  process.exit(1);
}
