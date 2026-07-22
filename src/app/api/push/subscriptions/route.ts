import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  deviceAlertCookieOptions,
  validDeviceAlertUuid,
  webPushSubscriptionCookie,
} from "@/lib/device-alert-cookies";
import { createAdminClient } from "@/lib/supabase/admin";
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

  return userId;
}

async function updatePushPreference({
  enabled,
  admin,
  userId,
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  enabled: boolean;
  userId: string;
}) {
  return admin
    .from("profiles")
    .update({
      notify_push_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function GET() {
  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const cookieStore = await cookies();
  const subscriptionId = cookieStore.get(webPushSubscriptionCookie)?.value;

  if (!validDeviceAlertUuid(subscriptionId)) {
    return NextResponse.json({ enabled: false });
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("id", subscriptionId)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: "Subscription status failed." }, { status: 500 });
  }

  return NextResponse.json({ enabled: Boolean(data) });
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

  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (process.env.TTC_WEB_PUSH_REGISTRATION_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();
  const { data: existingSubscription, error: lookupError } = await admin
    .from("push_subscriptions")
    .select("id, profile_id")
    .eq("endpoint", endpoint)
    .maybeSingle<{ id: string; profile_id: string }>();

  if (
    lookupError ||
    (existingSubscription && existingSubscription.profile_id !== userId)
  ) {
    return NextResponse.json(
      { error: "Subscription rejected." },
      { status: 409 },
    );
  }

  const registration = {
    auth_key: authKey,
    is_active: true,
    last_seen_at: now,
    p256dh_key: p256dhKey,
    updated_at: now,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
  const registrationResult = existingSubscription
    ? await admin
        .from("push_subscriptions")
        .update(registration)
        .eq("id", existingSubscription.id)
        .eq("profile_id", userId)
        .select("id")
        .single<{ id: string }>()
    : await admin
        .from("push_subscriptions")
        .insert({
          ...registration,
          endpoint,
          profile_id: userId,
        })
        .select("id")
        .single<{ id: string }>();
  const { data: subscription, error } = registrationResult;

  if (error || !subscription) {
    return NextResponse.json({ error: "Subscription rejected." }, { status: 400 });
  }

  const { error: preferenceError } = await updatePushPreference({
    enabled: true,
    admin,
    userId,
  });

  if (preferenceError) {
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", userId)
      .eq("endpoint", endpoint);

    return NextResponse.json(
      { error: "Alert preference could not be saved." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    webPushSubscriptionCookie,
    subscription.id,
    deviceAlertCookieOptions,
  );

  return response;
}

export async function DELETE(request: Request) {
  let payload: { endpoint?: unknown };

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const endpoint = cleanPushString(payload.endpoint, 2000);
  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!validEndpoint(endpoint)) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: "Subscription update failed." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(webPushSubscriptionCookie, "", {
    ...deviceAlertCookieOptions,
    maxAge: 0,
  });

  return response;
}
