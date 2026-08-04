export type AdPurchaseSurface = "android" | "ios" | "web";

type AdPurchaseEnvironment = Record<string, unknown>;

const adPurchaseGateBySurface = {
  android: "TTC_ANDROID_AD_PURCHASES_ENABLED",
  ios: "TTC_IOS_AD_PURCHASES_ENABLED",
  web: "TTC_WEB_AD_PURCHASES_ENABLED",
} as const satisfies Record<AdPurchaseSurface, string>;

const nativeSurfaceMarkers = {
  android: /(?:^|\s)TTCNative\/Android(?:\s|$)/,
  ios: /(?:^|\s)TTCNative\/iOS(?:\s|$)/,
} as const;

export function adPurchaseSurfaceFromUserAgent(
  userAgent: unknown,
): AdPurchaseSurface {
  if (typeof userAgent !== "string") return "web";

  const matches = (Object.entries(nativeSurfaceMarkers) as Array<
    [Exclude<AdPurchaseSurface, "web">, RegExp]
  >)
    .filter(([, marker]) => marker.test(userAgent))
    .map(([surface]) => surface);

  return matches.length === 1 ? matches[0] : "web";
}

export function adPurchaseSurfaceEnabled(
  surface: unknown,
  environment: AdPurchaseEnvironment = process.env,
) {
  if (
    typeof surface !== "string" ||
    !(surface in adPurchaseGateBySurface)
  ) {
    return false;
  }

  const gate = adPurchaseGateBySurface[surface as AdPurchaseSurface];
  return environment[gate] === "true";
}

export function anyAdPurchaseSurfaceEnabled(
  environment: AdPurchaseEnvironment = process.env,
) {
  return (Object.keys(adPurchaseGateBySurface) as AdPurchaseSurface[]).some(
    (surface) => adPurchaseSurfaceEnabled(surface, environment),
  );
}
