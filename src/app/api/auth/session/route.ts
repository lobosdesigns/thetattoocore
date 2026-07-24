import { nativeSessionFailureStatus } from "@/lib/native-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sessionResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
  Vary: "Cookie",
} as const;

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user) {
    return new Response(null, {
      headers: sessionResponseHeaders,
      status: 204,
    });
  }

  const failureStatus = nativeSessionFailureStatus(error);

  if (failureStatus === 503) {
    return new Response(null, {
      headers: {
        ...sessionResponseHeaders,
        "Retry-After": "2",
      },
      status: 503,
    });
  }

  await supabase.auth.signOut({ scope: "local" });

  return new Response(null, {
    headers: sessionResponseHeaders,
    status: 401,
  });
}
