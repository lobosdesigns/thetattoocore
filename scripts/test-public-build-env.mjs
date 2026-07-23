import {
  publicBuildConfigError,
  publicBuildEnvIsValid,
} from "./lib/public-build-env.mjs";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_fixture_key_1234567890",
};

const cases = [
  {
    label: "valid public build configuration",
    env: validEnv,
    expected: true,
  },
  {
    label: "missing public URL",
    env: { ...validEnv, NEXT_PUBLIC_SUPABASE_URL: undefined },
    expected: false,
  },
  {
    label: "missing publishable key",
    env: { ...validEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined },
    expected: false,
  },
  {
    label: "malformed public URL",
    env: { ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" },
    expected: false,
  },
  {
    label: "insecure public URL",
    env: { ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "http://example.invalid" },
    expected: false,
  },
  {
    label: "public URL with credentials",
    env: {
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://user:pass@example.invalid",
    },
    expected: false,
  },
  {
    label: "placeholder publishable key",
    env: {
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "replace_with_supabase_publishable_key",
    },
    expected: false,
  },
  {
    label: "secret key in public configuration",
    env: {
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_secret_fixture_key_1234567890",
    },
    expected: false,
  },
];

let failures = 0;

for (const testCase of cases) {
  const actual = publicBuildEnvIsValid(testCase.env);
  const passed = actual === testCase.expected;
  console.log(`${passed ? "PASS" : "FAIL"} ${testCase.label}`);
  failures += passed ? 0 : 1;
}

const neutralErrorPassed =
  publicBuildConfigError === "Public app configuration is unavailable." &&
  !/supabase|provider|backend|key|url/i.test(publicBuildConfigError);
console.log(
  `${neutralErrorPassed ? "PASS" : "FAIL"} member-safe configuration failure message`,
);
failures += neutralErrorPassed ? 0 : 1;

if (failures > 0) {
  console.error(`${failures} public build environment test(s) failed.`);
  process.exit(1);
}
