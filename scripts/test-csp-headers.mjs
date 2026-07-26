import assert from "node:assert/strict";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const csp = await importSelfContainedTypeScript(
  "../src/lib/security/csp.ts",
  import.meta.url,
);

const policy = csp.contentSecurityPolicy();
const directives = new Map(
  policy.split("; ").map((entry) => {
    const [name, ...sources] = entry.split(" ");
    return [name, sources];
  }),
);

assert.equal(csp.cspHeaderKey({}), "Content-Security-Policy-Report-Only");
assert.equal(
  csp.cspHeaderKey({ TTC_CSP_ENFORCE_ENABLED: "false" }),
  "Content-Security-Policy-Report-Only",
);
assert.equal(
  csp.cspHeaderKey({ TTC_CSP_ENFORCE_ENABLED: "TRUE" }),
  "Content-Security-Policy-Report-Only",
);
assert.equal(
  csp.cspHeaderKey({ TTC_CSP_ENFORCE_ENABLED: "true" }),
  "Content-Security-Policy",
);
assert.deepEqual(csp.cspHeader({}), ["Content-Security-Policy-Report-Only", policy]);
assert.deepEqual(csp.cspHeader({ TTC_CSP_ENFORCE_ENABLED: "true" }), [
  "Content-Security-Policy",
  policy,
]);

for (const requiredDirective of [
  "default-src",
  "base-uri",
  "object-src",
  "frame-ancestors",
  "form-action",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "frame-src",
  "child-src",
  "worker-src",
  "manifest-src",
]) {
  assert.ok(directives.has(requiredDirective), `missing ${requiredDirective}`);
}

const requiredSources = new Map([
  ["script-src", ["'self'", "'unsafe-inline'", "https://js.stripe.com"]],
  ["style-src", ["'self'", "'unsafe-inline'"]],
  [
    "connect-src",
    [
      "'self'",
      "https://*.supabase.co",
      "https://*.supabase.in",
      "wss://*.supabase.co",
      "wss://*.supabase.in",
      "https://api.stripe.com",
    ],
  ],
  [
    "img-src",
    [
      "'self'",
      "data:",
      "blob:",
      "https://*.supabase.co",
      "https://*.supabase.in",
    ],
  ],
  ["font-src", ["'self'", "data:"]],
  ["media-src", ["'self'", "blob:", "https://*.supabase.co", "https://*.supabase.in"]],
  ["form-action", ["'self'", "https://checkout.stripe.com"]],
  [
    "frame-src",
    ["https://js.stripe.com", "https://hooks.stripe.com", "https://checkout.stripe.com"],
  ],
  ["worker-src", ["'self'", "blob:"]],
  ["manifest-src", ["'self'"]],
]);

for (const [directive, sources] of requiredSources) {
  const actualSources = directives.get(directive) ?? [];
  for (const source of sources) {
    assert.ok(actualSources.includes(source), `${directive} missing ${source}`);
  }
}

assert.equal([...directives.values()].some((sources) => sources.includes("https:")), false, "broad https: scheme source is not allowed");
assert.equal([...directives.values()].some((sources) => sources.includes("*")), false, "bare wildcard source is not allowed");
assert.equal(policy.includes("'unsafe-eval'"), false, "unsafe-eval is not allowed");

for (const [directive, sources] of directives) {
  assert.equal(new Set(sources).size, sources.length, `${directive} has duplicate sources`);
}

console.log("PASS CSP header policy flag and source contract");
