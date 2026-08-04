import assert from "node:assert/strict";
import { importTypeScriptWithStubs } from "./admin-module-test-harness.mjs";

const association = await importTypeScriptWithStubs(
  "src/lib/app-link-association.ts",
  {},
);

let getClaimsCalls = 0;
const middleware = await importTypeScriptWithStubs("src/middleware.ts", {
  "@/lib/app-link-association": {
    androidAssetLinksPayload: association.androidAssetLinksPayload,
    appleAppSiteAssociationPayload: association.appleAppSiteAssociationPayload,
    associationJsonResponse: association.associationJsonResponse,
    unavailableAssociationResponse: association.unavailableAssociationResponse,
  },
  "@/lib/auth-session": {
    authCookieOptions: (options) => options,
    authSessionPreferenceCookie: "ttc-session",
    persistentSessionFromValue: () => false,
  },
  "@/lib/security/csp": {
    cspHeader: () => ["Content-Security-Policy", "default-src 'self'"],
    cspHeaderName: "Content-Security-Policy",
    cspReportOnlyHeaderName: "Content-Security-Policy-Report-Only",
  },
  "@supabase/ssr": {
    createServerClient() {
      return {
        auth: {
          async getClaims() {
            getClaimsCalls += 1;
            return { data: null, error: null };
          },
        },
      };
    },
  },
  "next/server": {
    NextRequest: class {},
    NextResponse: {
      next() {
        return new Response(null);
      },
      redirect(url, status) {
        return new Response(null, {
          headers: { location: String(url) },
          status,
        });
      },
    },
  },
});

function fakeRequest(pathname, host, protocol = "https:") {
  const url = new URL(`${protocol}//${host}${pathname}`);
  const cookieValues = new Map();

  return {
    cookies: {
      get(name) {
        const value = cookieValues.get(name);
        return value === undefined ? undefined : { name, value };
      },
      getAll() {
        return [...cookieValues].map(([name, value]) => ({ name, value }));
      },
      set(name, value) {
        cookieValues.set(name, value);
      },
    },
    headers: new Headers({ host }),
    nextUrl: {
      pathname: url.pathname,
      protocol: url.protocol,
      clone() {
        return new URL(url);
      },
    },
  };
}

const originalAndroidFingerprints =
  process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
const originalAppleAppIds = process.env.TTC_IOS_APP_LINK_APP_IDS;

try {
  const testAndroidFingerprint = Array.from(
    { length: 32 },
    (_, index) => index.toString(16).padStart(2, "0"),
  )
    .join(":")
    .toUpperCase();
  const testAppleAppId = "ABCDEFGHIJ.com.thetattoocore.app";
  process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
    testAndroidFingerprint;
  process.env.TTC_IOS_APP_LINK_APP_IDS = testAppleAppId;

  const associationPaths = [
    "/.well-known/assetlinks.json",
    "/.well-known/apple-app-site-association",
  ];

  for (const host of ["thetattoocore.com", "www.thetattoocore.com"]) {
    for (const pathname of associationPaths) {
      const response = await middleware.middleware(fakeRequest(pathname, host));

      assert.equal(
        response.status,
        200,
        `${host}${pathname} must be served directly without a canonical redirect`,
      );
      assert.equal(response.headers.get("location"), null);
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/i);
      assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
      const body = await response.text();
      const payload = JSON.parse(body);

      if (pathname.endsWith("assetlinks.json")) {
        assert.equal(payload[0]?.target?.package_name, "com.thetattoocore.app");
        assert.deepEqual(payload[0]?.target?.sha256_cert_fingerprints, [
          testAndroidFingerprint,
        ]);
        assert.deepEqual(payload[0]?.relation, [
          "delegate_permission/common.handle_all_urls",
        ]);
      } else {
        assert.deepEqual(payload?.applinks?.apps, []);
        assert.equal(payload?.applinks?.details?.[0]?.appID, testAppleAppId);
        assert.ok(payload?.applinks?.details?.[0]?.paths?.includes("/u/*"));
        assert.ok(payload?.applinks?.details?.[0]?.paths?.includes("/messages*"));
      }

      const insecureResponse = await middleware.middleware(
        fakeRequest(pathname, host, "http:"),
      );
      assert.equal(
        insecureResponse.status,
        308,
        `http://${host}${pathname} must redirect to canonical HTTPS`,
      );
      assert.equal(
        insecureResponse.headers.get("location"),
        `https://thetattoocore.com${pathname}`,
      );
    }
  }

  delete process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
  delete process.env.TTC_IOS_APP_LINK_APP_IDS;
  const unavailable = await middleware.middleware(
    fakeRequest("/.well-known/assetlinks.json", "www.thetattoocore.com"),
  );

  assert.equal(unavailable.status, 404);
  assert.equal(unavailable.headers.get("location"), null);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");

  const canonicalRedirect = await middleware.middleware(
    fakeRequest("/about?source=www", "www.thetattoocore.com"),
  );

  assert.equal(canonicalRedirect.status, 308);
  assert.equal(
    canonicalRedirect.headers.get("location"),
    "https://thetattoocore.com/about?source=www",
  );
  assert.equal(getClaimsCalls, 0);
} finally {
  if (originalAndroidFingerprints === undefined) {
    delete process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
  } else {
    process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
      originalAndroidFingerprints;
  }

  if (originalAppleAppIds === undefined) {
    delete process.env.TTC_IOS_APP_LINK_APP_IDS;
  } else {
    process.env.TTC_IOS_APP_LINK_APP_IDS = originalAppleAppIds;
  }
}

console.log(
  "PASS HTTPS apex and www association routes bypass host redirects while HTTP and ordinary www routes redirect canonically",
);
