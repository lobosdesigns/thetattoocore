import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PushPayload = {
  endpoint?: unknown;
  keys?: {
    auth?: unknown;
    p256dh?: unknown;
  };
};

function cleanPushString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);

    return url.protocol === "https:" && endpoint.length <= 2000;
  } catch {
    return false;
  }
}

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  return { supabase, userId };
}

export async function POST(request: Request) {
  let payload: PushPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const endpoint = cleanPushString(payload.endpoint, 2000);
  const p256dhKey = cleanPushString(payload.keys?.p256dh, 500);
  const authKey = cleanPushString(payload.keys?.auth, 500);

  if (
    !validEndpoint(endpoint) ||
    p256dhKey.length < 20 ||
    authKey.length < 10
  ) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const { supabase, userId } = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth_key: authKey,
      endpoint,
      is_active: true,
      last_seen_at: now,
      p256dh_key: p256dhKey,
      profile_id: userId,
      updated_at: now,
      user_agent: userAgent,
    },
    { onConflict: "profile_id,endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "Subscription rejected." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let payload: { endpoint?: unknown };

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const endpoint = cleanPushString(payload.endpoint, 2000);
  const { supabase, userId } = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!validEndpoint(endpoint)) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: "Subscription update failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
