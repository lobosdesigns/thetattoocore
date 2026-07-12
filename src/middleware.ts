import { NextResponse } from "next/server";

const securityHeaders = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"],
  [
    "Permissions-Policy",
    'camera=(), microphone=(), payment=(self "https://checkout.stripe.com")',
  ],
] as const;

export function middleware() {
  const response = NextResponse.next();

  for (const [key, value] of securityHeaders) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "experimental-edge",
};
