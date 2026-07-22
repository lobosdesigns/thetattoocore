import type { SerializeOptions } from "cookie";

export const authSessionPreferenceCookie = "ttc_auth_session";

const persistentSessionMaxAge = 400 * 24 * 60 * 60;

export function persistentSessionFromValue(value?: string | null) {
  return value !== "session";
}

export function authCookieOptions(
  options: SerializeOptions,
  persistent: boolean,
) {
  if (persistent || options.maxAge === 0) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.expires;
  delete sessionOptions.maxAge;

  return sessionOptions;
}

export function authSessionPreferenceCookieOptions(
  persistent: boolean,
  secure: boolean,
): SerializeOptions {
  return {
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure,
    ...(persistent ? { maxAge: persistentSessionMaxAge } : {}),
  };
}

export function authSessionPreferenceValue(persistent: boolean) {
  return persistent ? "persistent" : "session";
}
