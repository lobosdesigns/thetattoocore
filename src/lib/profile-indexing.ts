export const internalProfileUsernames = [
  "checkouttest",
  "qa_android_dm",
  "ttc_reviewer",
  "ttc_tester",
] as const;

const internalProfileUsernameSet = new Set<string>(internalProfileUsernames);

export function isInternalIndexingProfile(username: string | null | undefined) {
  return Boolean(username && internalProfileUsernameSet.has(username.toLowerCase()));
}
