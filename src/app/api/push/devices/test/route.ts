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
import {
  buildNativePushQaAlert,
  nativePushQaDeliveryOutcome,
  nativePushQaDeliveryStatus,
  nativePushQaDirectConversationAllowed,
  readNativePushQaTarget,
} from "@/lib/native-push/qa-target";
import { sendNativePushMessage } from "@/lib/native-push/sender";
import {
  nativePushSenderReady,
  type NativePushDeliveryEnvironment,
} from "@/lib/native-push/sender-core";
import {
  allowsNoisyDeliveryNow,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AuthenticatedProfile = NotificationPreferenceProfile & {
  id: string;
  notify_push_enabled: boolean;
  role: string | null;
};

type RegisteredDevice = {
  app_build: string;
  app_version: string;
  id: string;
  platform: "android" | "ios";
  token: string;
};

type ConversationMessage = {
  conversation_id: string;
  id: string;
};

type ConversationMember = {
  user_id: string;
};

type MessageNotificationCandidate = {
  actor_id: string | null;
  message_id: string | null;
};

const recentMessageCandidateLimit = 10;
const testAlertDelayMs = 8_000;

export const maxDuration = 60;

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
    .select(
      "id, notification_quiet_hours_enabled, notification_quiet_hours_end, notification_quiet_hours_start, notification_timezone, notify_message_activity, notify_push_enabled, role",
    )
    .eq("id", userId)
    .maybeSingle<AuthenticatedProfile>();

  return error ? null : profile;
}

function expiredDeviceCookie(response: NextResponse) {
  response.cookies.set(nativePushDeviceCookie, "", {
    ...deviceAlertCookieOptions,
    maxAge: 0,
  });

  return response;
}

async function recentMessageConversationId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
) {
  const { data: notificationRows, error: notificationError } = await admin
    .from("notifications")
    .select("actor_id, message_id")
    .eq("recipient_id", profileId)
    .eq("type", "message")
    .not("actor_id", "is", null)
    .not("message_id", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(recentMessageCandidateLimit)
    .returns<MessageNotificationCandidate[]>();

  if (notificationError) throw new Error("Message alerts unavailable.");

  const candidates = notificationRows ?? [];
  const messageIds = [
    ...new Set(
      candidates
        .map((candidate) => candidate.message_id)
        .filter((messageId): messageId is string => Boolean(messageId)),
    ),
  ];

  if (messageIds.length === 0) return null;

  const { data: messages, error: messageError } = await admin
    .from("messages")
    .select("conversation_id, id")
    .in("id", messageIds)
    .returns<ConversationMessage[]>();

  if (messageError) throw new Error("Messages unavailable.");

  const messageById = new Map(
    (messages ?? []).map((message) => [message.id, message]),
  );

  for (const candidate of candidates) {
    if (!candidate.actor_id || !candidate.message_id) continue;

    const message = messageById.get(candidate.message_id);

    if (!message) continue;

    const [membershipResult, blockResult] = await Promise.all([
      admin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", message.conversation_id)
        .order("user_id", { ascending: true })
        .limit(3)
        .returns<ConversationMember[]>(),
      admin
        .from("user_blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${profileId},blocked_id.eq.${candidate.actor_id}),and(blocker_id.eq.${candidate.actor_id},blocked_id.eq.${profileId})`,
        )
        .limit(1)
        .maybeSingle<{ blocker_id: string }>(),
    ]);

    if (membershipResult.error || blockResult.error) {
      throw new Error("Message eligibility unavailable.");
    }

    if (
      nativePushQaDirectConversationAllowed({
        actorId: candidate.actor_id,
        blocked: Boolean(blockResult.data),
        memberIds: (membershipResult.data ?? []).map(
          (membership) => membership.user_id,
        ),
        profileId,
      })
    ) {
      return message.conversation_id;
    }
  }

  return null;
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

  const target = await readNativePushQaTarget(request);

  if (!target) {
    return NextResponse.json(
      { error: "Test alert request is invalid." },
      { status: 400 },
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

  if (!allowsNoisyDeliveryNow(profile, "message")) {
    return NextResponse.json({
      reason: "settings",
      scheduled: false,
      suppressed: true,
    });
  }

  let conversationId: string | null = null;

  if (target === "latest_message") {
    try {
      conversationId = await recentMessageConversationId(admin, profile.id);
    } catch {
      return NextResponse.json(
        { error: "Test alerts are not available." },
        { status: 503 },
      );
    }
  }

  const alert = buildNativePushQaAlert(target, conversationId);

  if (!alert) {
    return NextResponse.json(
      {
        error:
          "A message test needs a recent message alert. Receive a message, then retry.",
        reason: "no_message",
      },
      { status: 409 },
    );
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, testAlertDelayMs);
  });

  const result = await sendNativePushMessage(nativePushEnvironment, {
    ...alert,
    notificationId: crypto.randomUUID(),
    platform: device.platform,
    token: device.token,
  });
  const outcome = nativePushQaDeliveryOutcome(result);

  if (outcome === "device") {
    await admin
      .from("native_push_devices")
      .delete()
      .eq("id", device.id)
      .eq("profile_id", profile.id);

    return expiredDeviceCookie(
      NextResponse.json(
        {
          error: "Turn app alerts on again, then retry.",
          reason: "device",
        },
        { status: nativePushQaDeliveryStatus(outcome) },
      ),
    );
  }

  if (outcome === "retry") {
    return NextResponse.json(
      {
        error: "Test alert could not be accepted. Try again.",
        reason: "retry",
      },
      { status: nativePushQaDeliveryStatus(outcome) },
    );
  }

  return NextResponse.json(
    { accepted: true },
    { status: nativePushQaDeliveryStatus(outcome) },
  );
}
