const internalProfileUsernames = new Set([
  "checkouttest",
  "qa_android_dm",
  "ttc_reviewer",
  "ttc_tester",
]);

export function isInternalIndexingProfile(username: string | null | undefined) {
  return Boolean(username && internalProfileUsernames.has(username.toLowerCase()));
}
