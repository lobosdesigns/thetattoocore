export const cspEnforceFlag = "TTC_CSP_ENFORCE_ENABLED";
export const cspHeaderName = "Content-Security-Policy";
export const cspReportOnlyHeaderName = "Content-Security-Policy-Report-Only";

type CspDirective = readonly [name: string, sources: readonly string[]];

export const cspDirectives = [
  ["default-src", ["'self'"]],
  ["base-uri", ["'self'"]],
  ["object-src", ["'none'"]],
  ["frame-ancestors", ["'none'"]],
  ["form-action", ["'self'", "https://checkout.stripe.com"]],
  // Next.js currently emits framework bootstrap/style tags without per-request
  // nonces in this OpenNext Cloudflare static-friendly architecture.
  ["script-src", ["'self'", "'unsafe-inline'", "https://js.stripe.com"]],
  ["style-src", ["'self'", "'unsafe-inline'"]],
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
    "media-src",
    ["'self'", "blob:", "https://*.supabase.co", "https://*.supabase.in"],
  ],
  [
    "frame-src",
    [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://checkout.stripe.com",
    ],
  ],
  [
    "child-src",
    [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://checkout.stripe.com",
    ],
  ],
  ["worker-src", ["'self'", "blob:"]],
  ["manifest-src", ["'self'"]],
] as const satisfies readonly CspDirective[];

export function contentSecurityPolicy() {
  return cspDirectives
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

export function cspHeaderKey(env = process.env) {
  return env[cspEnforceFlag] === "true"
    ? cspHeaderName
    : cspReportOnlyHeaderName;
}

export function cspHeader(env = process.env) {
  return [cspHeaderKey(env), contentSecurityPolicy()] as const;
}
