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
