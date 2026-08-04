import { NextResponse } from "next/server";
import {
  deviceAlertCookieOptions,
  nativePushCookieValue,
  nativePushDeviceCookie,
  validDeviceAlertUuid,
} from "@/lib/device-alert-cookies";
import {
  nativePushQaBuildAllowed,
  nativePushQaRoleAllowed,
} from "@/lib/native-push/qa-access";
import { readBoundedRequestBytes } from "@/lib/http/bounded-request-body.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DevicePlatform = "android" | "ios";

type NativeDevicePayload = {
  appBuild?: unknown;
  appVersion?: unknown;
  installationId?: unknown;
  platform?: unknown;
  token?: unknown;
};

const maxActiveDevices = 10;
const maxNativeDeviceBodyBytes = 12_000;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function cleanRequiredString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return value.length <= maxLength &&
    cleaned.length > 0 &&
    !controlCharacterPattern.test(cleaned)
    ? cleaned
    : null;
}

function cleanRequiredOpaqueString(value: unknown, maxLength: number) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim() ||
    controlCharacterPattern.test(value)
  ) {
    return null;
  }

  return value;
}

function validToken(token: string) {
  return token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
}

function cleanPlatform(value: unknown): DevicePlatform | null {
  return value === "android" || value === "ios" ? value : null;
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function authenticatedProfile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) return null;
  const admin = createAdminClient();

  if (!admin) return null;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string | null }>();

  return error ? null : profile;
}

async function readPayload(request: Request) {
  const body = await readBoundedRequestBytes(
    request,
    maxNativeDeviceBodyBytes,
  );

  if (!body.ok) return null;

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes);
    return JSON.parse(text) as NativeDevicePayload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const profile = await authenticatedProfile();

  if (!profile) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = profile.id;

  if (
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED !== "true" &&
    !nativePushQaRoleAllowed(profile.role)
  ) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 403 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const platform = cleanPlatform(searchParams.get("platform"));
  const installationId = cleanRequiredOpaqueString(
    searchParams.get("installationId"),
    36,
  );

  if (!platform || !installationId || !validDeviceAlertUuid(installationId)) {
    return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("native_push_devices")
    .select("id")
    .eq("profile_id", userId)
    .eq("platform", platform)
    .eq("installation_id", installationId)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: "Device registration status failed." }, { status: 500 });
  }

  return NextResponse.json({ enabled: Boolean(data) });
}

export async function POST(request: Request) {
  const profile = await authenticatedProfile();

  if (!profile) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = profile.id;

  if (process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const payload = await readPayload(request);
  const appBuild = cleanRequiredString(payload?.appBuild, 40);
  const appVersion = cleanRequiredString(payload?.appVersion, 40);
  const platform = cleanPlatform(payload?.platform);
  const installationId = cleanRequiredOpaqueString(payload?.installationId, 36);
  const token = cleanRequiredOpaqueString(payload?.token, 4096);

  if (
    !appBuild ||
    !appVersion ||
    !platform ||
    !installationId ||
    !token ||
    !validDeviceAlertUuid(installationId) ||
    !validToken(token)
  ) {
    return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });
  }

  if (
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED !== "true" &&
    (!nativePushQaRoleAllowed(profile.role) ||
      !nativePushQaBuildAllowed(platform, appVersion, appBuild))
  ) {
    return NextResponse.json(
      { error: "Device alert setup is not available for this build." },
      { status: 403 },
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
  const tokenHash = await hashToken(token);

  const { error: reusedTokenError } = await admin
    .from("native_push_devices")
    .delete()
    .eq("token_hash", tokenHash)
    .or(`platform.neq.${platform},installation_id.neq.${installationId}`);

  if (reusedTokenError) {
    return NextResponse.json({ error: "Device registration failed." }, { status: 400 });
  }

  const { error: priorOwnerError } = await admin
    .from("native_push_devices")
    .delete()
    .eq("platform", platform)
    .eq("installation_id", installationId)
    .neq("profile_id", userId);

  if (priorOwnerError) {
    return NextResponse.json({ error: "Device registration failed." }, { status: 400 });
  }

  const { error: registrationError } = await admin
    .from("native_push_devices")
    .upsert(
      {
        app_build: appBuild,
        app_version: appVersion,
        installation_id: installationId,
        is_active: true,
        last_seen_at: now,
        platform,
        profile_id: userId,
        token,
        token_hash: tokenHash,
        updated_at: now,
      },
      { onConflict: "platform,installation_id" },
    );

  if (registrationError) {
    return NextResponse.json({ error: "Device registration failed." }, { status: 500 });
  }

  const { error: preferenceError } = await admin
    .from("profiles")
    .update({
      notify_push_enabled: true,
      updated_at: now,
    })
    .eq("id", userId);

  if (preferenceError) {
    await admin
      .from("native_push_devices")
      .delete()
      .eq("profile_id", userId)
      .eq("platform", platform)
      .eq("installation_id", installationId);

    return NextResponse.json(
      { error: "Alert preference could not be saved." },
      { status: 500 },
    );
  }

  const { data: activeDevices, error: activeDeviceError } = await admin
    .from("native_push_devices")
    .select("id")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (activeDeviceError) {
    return NextResponse.json({ error: "Device registration failed." }, { status: 400 });
  }

  const excessDeviceIds = (activeDevices ?? [])
    .slice(maxActiveDevices)
    .map((device) => device.id);

  if (excessDeviceIds.length > 0) {
    const { error } = await admin
      .from("native_push_devices")
      .delete()
      .in("id", excessDeviceIds);

    if (error) {
      return NextResponse.json({ error: "Device registration failed." }, { status: 400 });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    nativePushDeviceCookie,
    nativePushCookieValue(platform, installationId),
    deviceAlertCookieOptions,
  );

  return response;
}

export async function DELETE(request: Request) {
  const profile = await authenticatedProfile();

  if (!profile) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const userId = profile.id;

  const payload = await readPayload(request);
  const platform = cleanPlatform(payload?.platform);
  const installationId = cleanRequiredOpaqueString(payload?.installationId, 36);

  if (!platform || !installationId || !validDeviceAlertUuid(installationId)) {
    return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "Device alert setup is not available." },
      { status: 503 },
    );
  }

  const { error } = await admin
    .from("native_push_devices")
    .delete()
    .eq("profile_id", userId)
    .eq("platform", platform)
    .eq("installation_id", installationId);

  if (error) {
    return NextResponse.json({ error: "Device registration update failed." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(nativePushDeviceCookie, "", {
    ...deviceAlertCookieOptions,
    maxAge: 0,
  });

  return response;
}
