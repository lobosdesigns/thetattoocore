import { type NextRequest, NextResponse } from "next/server";
import {
  deviceAlertCookieOptions,
  nativePushDeviceCookie,
  parseNativePushCookie,
} from "@/lib/device-alert-cookies";
import {
  nativePushQaBuildAllowed,
  nativePushQaRoleAllowed,
} from "@/lib/native-push/qa-access";
import { sendNativePushMessage } from "@/lib/native-push/sender";
import {
  nativePushSenderReady,
  type NativePushDeliveryEnvironment,
} from "@/lib/native-push/sender-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RegisteredDevice = {
  app_build: string;
  app_version: string;
  id: string;
  platform: "android" | "ios";
  token: string;
};

const testAlertDelayMs = 8_000;

const nativePushEnvironment: NativePushDeliveryEnvironment = {
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TTC_DEVICE_ALERT_SETUP_ENABLED:
    process.env.TTC_DEVICE_ALERT_SETUP_ENABLED,
  TTC_NATIVE_PUSH_DELIVERY_ENABLED:
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED,
  TTC_NATIVE_PUSH_REGISTRATION_ENABLED:
    process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED,
};

async function authenticatedProfile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) return null;
  const admin = createAdminClient();

  if (!admin) return null;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, notify_push_enabled, role")
    .eq("id", userId)
    .maybeSingle<{
      id: string;
      notify_push_enabled: boolean;
      role: string | null;
    }>();

  return error ? null : profile;
}

function expiredDeviceCookie(response: NextResponse) {
  response.cookies.set(nativePushDeviceCookie, "", {
    ...deviceAlertCookieOptions,
    maxAge: 0,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const profile = await authenticatedProfile();

  if (!profile) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!nativePushQaRoleAllowed(profile.role)) {
    return NextResponse.json(
      { error: "Test alerts are not available." },
      { status: 403 },
    );
  }

  if (
    !profile.notify_push_enabled ||
    !nativePushSenderReady(nativePushEnvironment)
  ) {
    return NextResponse.json(
      { error: "Test alerts are not available." },
      { status: 503 },
    );
  }

  const deviceCookie = parseNativePushCookie(
    request.cookies.get(nativePushDeviceCookie)?.value,
  );

  if (!deviceCookie) {
    return NextResponse.json(
      { error: "Turn app alerts off and on, then retry." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Test alerts are not available." },
      { status: 503 },
    );
  }

  const { data: device, error } = await admin
    .from("native_push_devices")
    .select("app_build, app_version, id, platform, token")
    .eq("profile_id", profile.id)
    .eq("platform", deviceCookie.platform)
    .eq("installation_id", deviceCookie.installationId)
    .eq("is_active", true)
    .maybeSingle<RegisteredDevice>();

  if (
    error ||
    !device ||
    !nativePushQaBuildAllowed(
      device.platform,
      device.app_version,
      device.app_build,
    )
  ) {
    return expiredDeviceCookie(
      NextResponse.json(
        { error: "Turn app alerts off and on, then retry." },
        { status: 409 },
      ),
    );
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, testAlertDelayMs);
  });

  const result = await sendNativePushMessage(nativePushEnvironment, {
    body: "Tap to verify app alerts.",
    notificationId: crypto.randomUUID(),
    platform: device.platform,
    title: "Test app alert",
    token: device.token,
    type: "test",
    url: "/notifications",
  });

  if (result === "success") {
    return NextResponse.json({ ok: true });
  }

  if (result === "token") {
    await admin
      .from("native_push_devices")
      .delete()
      .eq("id", device.id)
      .eq("profile_id", profile.id);

    return expiredDeviceCookie(
      NextResponse.json(
        { error: "Turn app alerts off and on, then retry." },
        { status: 409 },
      ),
    );
  }

  return NextResponse.json(
    { error: "Test alert could not be sent. Try again." },
    { status: result === "disabled" ? 503 : 502 },
  );
}
