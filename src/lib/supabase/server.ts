import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  authCookieOptions,
  authSessionPreferenceCookie,
  persistentSessionFromValue,
} from "../auth-session";

export async function createClient(options: { persistentSession?: boolean } = {}) {
  const cookieStore = await cookies();
  const persistentSession =
    options.persistentSession ??
    persistentSessionFromValue(
      cookieStore.get(authSessionPreferenceCookie)?.value,
    );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
              cookieStore.set(
                name,
                value,
                authCookieOptions(cookieOptions, persistentSession),
              ),
            );
          } catch {
            // Server Components cannot write cookies; route handlers and proxy can.
          }
        },
      },
    },
  );
}
