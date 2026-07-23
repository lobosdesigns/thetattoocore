export type NativePushPlatform = "android" | "ios";

type NativePushBuild = {
  build: string;
  version: string;
};

export const nativePushQaBuilds: Record<NativePushPlatform, NativePushBuild> = {
  android: { build: "4", version: "1.0.3" },
  ios: { build: "4", version: "1.0" },
};

export function nativePushQaRoleAllowed(role?: string | null) {
  return role === "admin" || role === "owner";
}

export function nativePushQaBuildAllowed(
  platform: NativePushPlatform,
  appVersion: string,
  appBuild: string,
) {
  const expected = nativePushQaBuilds[platform];

  return expected.version === appVersion && expected.build === appBuild;
}
