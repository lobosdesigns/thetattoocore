import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  androidAssetLinksPayload,
  appleAppSiteAssociationPayload,
  associationJsonResponse,
  unavailableAssociationResponse,
} from "@/lib/app-link-association";

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

function applySecurityHeaders<T extends Response>(response: T): T {
  for (const [key, value] of securityHeaders) {
    response.headers.set(key, value);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/.well-known/assetlinks.json") {
    const payload = androidAssetLinksPayload();

    return applySecurityHeaders(
      payload ? associationJsonResponse(payload) : unavailableAssociationResponse(),
    );
  }

  if (request.nextUrl.pathname === "/.well-known/apple-app-site-association") {
    const payload = appleAppSiteAssociationPayload();

    return applySecurityHeaders(
      payload
        ? associationJsonResponse(payload, "application/json")
        : unavailableAssociationResponse(),
    );
  }

  let response = applySecurityHeaders(NextResponse.next({ request }));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = applySecurityHeaders(NextResponse.next({ request }));

          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "experimental-edge",
};
