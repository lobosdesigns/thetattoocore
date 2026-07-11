export const userGeneratedLinkRel = "ugc nofollow noopener noreferrer";

export function cleanExternalUrl(value: FormDataEntryValue | null, maxLength = 300) {
  const text = String(value ?? "")
    .trim()
    .slice(0, maxLength);

  if (!text) return null;

  try {
    const url = new URL(text);

    if (!["http:", "https:"].includes(url.protocol)) return null;

    return url.toString();
  } catch {
    return null;
  }
}
