import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import {
  authCookieOptions,
  authSessionPreferenceCookie,
  persistentSessionFromValue,
} from "../auth-session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Public app configuration is unavailable.");
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return Object.entries(parse(document.cookie)).flatMap(
          ([name, value]) => (value === undefined ? [] : [{ name, value }]),
        );
      },
      setAll(cookiesToSet) {
        const currentCookies = parse(document.cookie);
        const persistentSession = persistentSessionFromValue(
          currentCookies[authSessionPreferenceCookie],
        );

        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serialize(
            name,
            value,
            authCookieOptions(options, persistentSession),
          );
        });
      },
    },
  });
}
