export const notificationAllowedPaths = [
  "/",
  "/account",
  "/messages",
  "/notifications",
  "/saved",
  "/search",
] as const;

export const notificationAllowedPrefixes = [
  "/p/",
  "/t/",
  "/u/",
  "/merch/",
  "/stuff/",
  "/gigs/",
] as const;

export function safeNotificationPath(value: unknown) {
  const href = String(value ?? "").trim();

  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(href, "https://thetattoocore.local");
  } catch {
    return null;
  }

  if (
    !notificationAllowedPaths.includes(
      url.pathname as (typeof notificationAllowedPaths)[number],
    ) &&
    !notificationAllowedPrefixes.some((prefix) =>
      url.pathname.startsWith(prefix),
    )
  ) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function notificationPathOrFallback(value: unknown) {
  return safeNotificationPath(value) ?? "/notifications";
}

function foregroundAlertText(
  value: unknown,
  fallback: string,
  maxLength: number,
) {
  const text = typeof value === "string" ? value.trim() : "";

  return text ? text.slice(0, maxLength) : fallback;
}

export function nativeForegroundAlert(value: unknown) {
  const notification =
    value && typeof value === "object"
      ? (value as { body?: unknown; data?: unknown; title?: unknown })
      : {};
  const data =
    notification.data && typeof notification.data === "object"
      ? (notification.data as { url?: unknown })
      : {};

  return {
    body: foregroundAlertText(
      notification.body,
      "Open Notifications to view it.",
      180,
    ),
    title: foregroundAlertText(notification.title, "New alert", 80),
    url: notificationPathOrFallback(data.url),
  };
}
