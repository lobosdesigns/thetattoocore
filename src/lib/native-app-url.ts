const nativeAppOrigins = new Set([
  "https://thetattoocore.com",
  "https://www.thetattoocore.com",
]);

export function nativeAppPathOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    !nativeAppOrigins.has(url.origin) ||
    url.username ||
    url.password
  ) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}` || "/";
}
