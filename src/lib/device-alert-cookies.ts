export const nativePushDeviceCookie = "ttc_native_push_device";
export const webPushSubscriptionCookie = "ttc_web_push_subscription";

export const deviceAlertCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function nativePushCookieValue(
  platform: "android" | "ios",
  installationId: string,
) {
  return `${platform}:${installationId}`;
}

export function parseNativePushCookie(value?: string | null) {
  const [platform, installationId, ...rest] = String(value ?? "").split(":");

  if (
    rest.length > 0 ||
    (platform !== "android" && platform !== "ios") ||
    !uuidPattern.test(installationId)
  ) {
    return null;
  }

  return { installationId, platform };
}

export function validDeviceAlertUuid(value?: string | null) {
  return uuidPattern.test(String(value ?? ""));
}
