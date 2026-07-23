import { nativeAppPathOrNull } from "../src/lib/native-app-url.ts";

const checks = [
  {
    expected: "/p/post-id?from=share#comments",
    label: "production deep link keeps path query and hash",
    value:
      "https://thetattoocore.com/p/post-id?from=share#comments",
  },
  {
    expected: "/messages?to=artist",
    label: "www deep link stays in the app",
    value: "https://www.thetattoocore.com/messages?to=artist",
  },
  {
    expected: "/",
    label: "canonical root deep link opens the app home",
    value: "https://thetattoocore.com",
  },
  {
    expected: null,
    label: "external origin is rejected",
    value: "https://example.com/p/post-id",
  },
  {
    expected: null,
    label: "lookalike subdomain is rejected",
    value: "https://thetattoocore.com.example.com/p/post-id",
  },
  {
    expected: null,
    label: "insecure scheme is rejected",
    value: "http://thetattoocore.com/p/post-id",
  },
  {
    expected: null,
    label: "alternate port is rejected",
    value: "https://thetattoocore.com:8443/p/post-id",
  },
  {
    expected: null,
    label: "credential-bearing URL is rejected",
    value: "https://member@thetattoocore.com/p/post-id",
  },
  {
    expected: null,
    label: "protocol-relative URL is rejected",
    value: "//thetattoocore.com/p/post-id",
  },
  {
    expected: null,
    label: "non-string URL is rejected",
    value: { url: "https://thetattoocore.com" },
  },
];

let failures = 0;

for (const check of checks) {
  const actual = nativeAppPathOrNull(check.value);
  const passed = actual === check.expected;

  console.log(`${passed ? "PASS" : "FAIL"} ${check.label}`);
  if (!passed) failures += 1;
}

if (failures > 0) {
  console.error(`${failures} native app URL test(s) failed.`);
  process.exit(1);
}
