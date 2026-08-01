export type NativePushPlatform = "android" | "ios";

type NativePushBuild = {
  build: string;
  version: string;
};

export const nativePushQaBuilds: Record<
  NativePushPlatform,
  readonly NativePushBuild[]
> = {
  android: [
    { build: "4", version: "1.0.3" },
    { build: "5", version: "1.0.4" },
  ],
  ios: [
    { build: "4", version: "1.0" },
    { build: "5", version: "1.0" },
  ],
};

export function nativePushQaRoleAllowed(role?: string | null) {
  return role === "admin" || role === "owner";
}

export function nativePushQaBuildAllowed(
  platform: NativePushPlatform,
  appVersion: string,
  appBuild: string,
) {
  const allowedBuilds = nativePushQaBuilds[platform];

  return allowedBuilds.some(
    (allowed) => allowed.version === appVersion && allowed.build === appBuild,
  );
}
