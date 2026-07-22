import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import {
  authCookieOptions,
  authSessionPreferenceCookie,
  persistentSessionFromValue,
} from "../auth-session";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ytznkgcslezijkehwjsj.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_8hTy3UyxP93glZU1LN8YiQ_zs-5m2St";

export function createClient() {
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
