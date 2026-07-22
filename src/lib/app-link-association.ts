const androidPackageName =
  process.env.TTC_ANDROID_APP_LINK_PACKAGE_NAME?.trim() || "com.thetattoocore.app";

const associationPaths = [
  "/",
  "/u/*",
  "/p/*",
  "/t/*",
  "/stuff/*",
  "/gigs/*",
  "/merch",
  "/merch/*",
  "/help",
  "/help/*",
  "/support",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/account*",
  "/messages*",
  "/notifications*",
  "/settings*",
] as const;

function splitList(value?: string | null) {
  return (value ?? "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validAndroidFingerprint(value: string) {
  return /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(value);
}

function validAppleAppId(value: string) {
  return /^[A-Z0-9]{10}\.com\.thetattoocore\.app$/i.test(value);
}

export function androidAssetLinksPayload() {
  const fingerprints = splitList(process.env.TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS)
    .map((fingerprint) => fingerprint.toUpperCase())
    .filter(validAndroidFingerprint);

  if (!fingerprints.length) return null;

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: androidPackageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function appleAppSiteAssociationPayload() {
  const appIds = splitList(process.env.TTC_IOS_APP_LINK_APP_IDS)
    .map((appId) => appId.toUpperCase().replace(".COM.THETATTOOCORE.APP", ".com.thetattoocore.app"))
    .filter(validAppleAppId);

  if (!appIds.length) return null;

  return {
    applinks: {
      apps: [],
      details: appIds.map((appID) => ({
        appID,
        paths: [...associationPaths],
      })),
    },
  };
}

export function unavailableAssociationResponse() {
  return new Response("Association file is not available for this build.", {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
    status: 404,
  });
}

export function associationJsonResponse(body: unknown, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": contentType,
    },
    status: 200,
  });
}
