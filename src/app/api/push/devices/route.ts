import { NextResponse } from "next/server";
import {
  deviceAlertCookieOptions,
  nativePushCookieValue,
  nativePushDeviceCookie,
  validDeviceAlertUuid,
} from "@/lib/device-alert-cookies";
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
function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanRequiredString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
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

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return userId;
}

async function readPayload(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > 12_000) return null;

  try {
    const body = await request.text();

    if (body.length > 12_000) return null;

    return JSON.parse(body) as NativeDevicePayload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const platform = cleanPlatform(searchParams.get("platform"));
  const installationId = cleanString(searchParams.get("installationId"), 36);

  if (!platform || !validDeviceAlertUuid(installationId)) {
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
  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

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
  const installationId = cleanString(payload?.installationId, 36);
  const token = cleanString(payload?.token, 4096);

  if (
    !appBuild ||
    !appVersion ||
    !platform ||
    !validDeviceAlertUuid(installationId) ||
    !validToken(token)
  ) {
    return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });
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
  const userId = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const payload = await readPayload(request);
  const platform = cleanPlatform(payload?.platform);
  const installationId = cleanString(payload?.installationId, 36);

  if (!platform || !validDeviceAlertUuid(installationId)) {
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
