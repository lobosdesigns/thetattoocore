import assert from "node:assert/strict";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  androidNativePushChannelOptions,
  buildNativeMessage,
  buildServiceAccountJwtClaims,
  classifyFcmResponse,
  ensureAndroidNativePushChannel,
  nativePushDeliveryReady,
  nativePushSenderReady,
  retryDelaySeconds,
} = await importSelfContainedTypeScript(
  "../src/lib/native-push/sender-core.ts",
  import.meta.url,
);
const {
  nativePushQaBuildAllowed,
  nativePushQaRoleAllowed,
} = await importSelfContainedTypeScript(
  "../src/lib/native-push/qa-access.ts",
  import.meta.url,
);
const {
  buildNativePushQaAlert,
  nativePushQaDirectConversationAllowed,
  parseNativePushQaResponse,
  parseNativePushQaRequest,
  parseNativePushQaTarget,
  readNativePushQaTarget,
} = await importSelfContainedTypeScript(
  "../src/lib/native-push/qa-target.ts",
  import.meta.url,
);
const { allowsNoisyDeliveryNow } = await importSelfContainedTypeScript(
  "../src/lib/notifications.ts",
  import.meta.url,
);
const {
  nativeForegroundAlert,
  nativeSystemForegroundAlertPresented,
} = await importSelfContainedTypeScript(
  "../src/lib/notification-route.ts",
  import.meta.url,
);

const readyEnvironment = {
  FIREBASE_CLIENT_EMAIL: "sender@example.invalid",
  FIREBASE_PRIVATE_KEY: "private-key",
  FIREBASE_PROJECT_ID: "project-id",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "server-only",
  TTC_DEVICE_ALERT_SETUP_ENABLED: "true",
  TTC_NATIVE_PUSH_DELIVERY_ENABLED: "true",
  TTC_NATIVE_PUSH_REGISTRATION_ENABLED: "true",
};

assert.deepEqual(
  buildServiceAccountJwtClaims(
    readyEnvironment.FIREBASE_CLIENT_EMAIL,
    1_721_800_000,
  ),
  {
    aud: "https://oauth2.googleapis.com/token",
    exp: 1_721_803_600,
    iat: 1_721_800_000,
    iss: readyEnvironment.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  },
);

assert.equal(nativePushDeliveryReady(readyEnvironment), true);
assert.equal(
  nativePushSenderReady({
    ...readyEnvironment,
    TTC_NATIVE_PUSH_DELIVERY_ENABLED: "false",
  }),
  true,
);
assert.equal(
  nativePushDeliveryReady({
    ...readyEnvironment,
    TTC_NATIVE_PUSH_DELIVERY_ENABLED: "false",
  }),
  false,
);

for (const key of Object.keys(readyEnvironment)) {
  assert.equal(
    nativePushDeliveryReady({ ...readyEnvironment, [key]: "" }),
    false,
    `${key} must fail closed`,
  );
}

const android = buildNativeMessage({
  notificationId: "11111111-1111-4111-8111-111111111111",
  platform: "android",
  token: "device-token",
  url: "/messages?c=conversation",
});
const ios = buildNativeMessage({
  notificationId: "22222222-2222-4222-8222-222222222222",
  platform: "ios",
  token: "device-token",
  url: "/notifications",
});
const testAlert = buildNativeMessage({
  body: "Tap to verify app alerts.",
  notificationId: "33333333-3333-4333-8333-333333333333",
  platform: "android",
  title: "Test app alert",
  token: "device-token",
  type: "test",
  url: "/notifications",
});

assert.equal(
  typeof androidNativePushChannelOptions,
  "function",
  "Android native alerts must define a dedicated notification channel",
);
assert.equal(
  typeof ensureAndroidNativePushChannel,
  "function",
  "the native wrapper must be able to create its Android alert channel",
);
const androidChannel = androidNativePushChannelOptions();
assert.deepEqual(androidChannel, {
  description: "Messages, account activity, and important app updates.",
  id: "ttc_alerts_v1",
  importance: 4,
  lights: true,
  name: "TheTattooCore alerts",
  vibration: true,
  visibility: 0,
});

const createdChannels = [];
await ensureAndroidNativePushChannel("android", {
  createChannel: async (options) => createdChannels.push(options),
});
assert.deepEqual(createdChannels, [androidChannel]);
await ensureAndroidNativePushChannel("ios", {
  createChannel: async () => {
    throw new Error("iOS must not create an Android notification channel.");
  },
});
await assert.doesNotReject(() =>
  ensureAndroidNativePushChannel("android", {
    createChannel: async () => {
      throw { code: "UNAVAILABLE" };
    },
  }),
);
await assert.rejects(
  () =>
    ensureAndroidNativePushChannel("android", {
      createChannel: async () => {
        throw new Error("channel creation failed");
      },
    }),
  /channel creation failed/,
);

assert.equal(android.message.notification.title, "New message");
assert.equal(android.message.notification.body, "You have a new message.");
assert.equal(android.message.android.priority, "high");
assert.equal(
  android.message.android.notification.channel_id,
  androidChannel.id,
);
assert.equal(android.message.android.notification.sound, "default");
assert.equal(ios.message.apns.headers["apns-priority"], "10");
assert.equal(ios.message.data.url, "/notifications");
assert.equal(testAlert.message.data.type, "test");
assert.equal(testAlert.message.notification.title, "Test app alert");
assert.equal(testAlert.message.notification.body, "Tap to verify app alerts.");
assert.doesNotMatch(
  JSON.stringify([android, ios]),
  /message body|booking|payment|tracking/i,
);

assert.equal(classifyFcmResponse(200, {}), "success");
assert.equal(
  classifyFcmResponse(404, { error: { status: "UNREGISTERED" } }),
  "token",
);
assert.equal(
  classifyFcmResponse(400, {
    error: {
      details: [
        {
          "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
          errorCode: "INVALID_ARGUMENT",
        },
      ],
      status: "INVALID_ARGUMENT",
    },
  }),
  "token",
);
assert.equal(
  classifyFcmResponse(400, {
    error: {
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.BadRequest",
        },
      ],
      status: "INVALID_ARGUMENT",
    },
  }),
  "payload",
);
assert.equal(classifyFcmResponse(403, {}), "credentials");
assert.equal(classifyFcmResponse(429, {}), "temporary");
assert.equal(classifyFcmResponse(503, {}), "temporary");
assert.equal(classifyFcmResponse(418, {}), "unknown");

assert.equal(retryDelaySeconds(0, "30"), 30);
assert.equal(
  retryDelaySeconds(0, "Thu, 01 Jan 2026 00:00:20 GMT", Date.UTC(2026, 0, 1)),
  20,
);
assert.equal(retryDelaySeconds(2, null), 60);
assert.equal(retryDelaySeconds(99, null), 1920);

assert.equal(nativePushQaRoleAllowed("owner"), true);
assert.equal(nativePushQaRoleAllowed("admin"), true);
assert.equal(nativePushQaRoleAllowed("moderator"), false);
assert.equal(nativePushQaRoleAllowed("user"), false);
assert.equal(nativePushQaRoleAllowed(null), false);
assert.equal(nativePushQaBuildAllowed("android", "1.0.3", "4"), true);
assert.equal(nativePushQaBuildAllowed("android", "1.0.4", "5"), true);
assert.equal(nativePushQaBuildAllowed("android", "1.0.1", "2"), false);
assert.equal(nativePushQaBuildAllowed("android", "1.0.2", "3"), false);
assert.equal(nativePushQaBuildAllowed("ios", "1.0", "4"), true);
assert.equal(nativePushQaBuildAllowed("ios", "1.0", "5"), true);
assert.equal(nativePushQaBuildAllowed("ios", "1.0", "3"), false);

assert.equal(parseNativePushQaTarget(undefined), "notifications");
assert.equal(parseNativePushQaTarget("notifications"), "notifications");
assert.equal(parseNativePushQaTarget("latest_message"), "latest_message");
assert.equal(parseNativePushQaTarget("/messages?c=attacker"), null);
assert.equal(parseNativePushQaTarget({ url: "/messages?c=attacker" }), null);
assert.equal(parseNativePushQaRequest(undefined), "notifications");
assert.equal(
  parseNativePushQaRequest({ target: "latest_message" }),
  "latest_message",
);
assert.equal(
  parseNativePushQaRequest({
    target: "latest_message",
    url: "/messages?c=attacker",
  }),
  null,
);
assert.equal(
  parseNativePushQaRequest({ url: "/messages?c=attacker" }),
  null,
);
assert.equal(parseNativePushQaRequest({ target: "unknown" }), null);
assert.equal(
  await readNativePushQaTarget(
    new Request("https://example.invalid", { method: "POST" }),
  ),
  "notifications",
);
assert.equal(
  await readNativePushQaTarget(
    new Request("https://example.invalid", {
      body: JSON.stringify({ target: "latest_message" }),
      method: "POST",
    }),
  ),
  "latest_message",
);
assert.equal(
  await readNativePushQaTarget(
    new Request("https://example.invalid", {
      body: "{",
      method: "POST",
    }),
  ),
  null,
);
assert.equal(
  await readNativePushQaTarget(
    new Request("https://example.invalid", {
      body: `${" ".repeat(486)}{"target":"notifications"}`,
      method: "POST",
    }),
  ),
  "notifications",
);
assert.equal(
  await readNativePushQaTarget(
    new Request("https://example.invalid", {
      body: `${" ".repeat(487)}{"target":"notifications"}`,
      method: "POST",
    }),
  ),
  null,
);

assert.equal(
  nativePushQaDirectConversationAllowed({
    actorId: "66666666-6666-4666-8666-666666666666",
    blocked: false,
    memberIds: [
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ],
    profileId: "55555555-5555-4555-8555-555555555555",
  }),
  true,
);
assert.equal(
  nativePushQaDirectConversationAllowed({
    actorId: "66666666-6666-4666-8666-666666666666",
    blocked: true,
    memberIds: [
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ],
    profileId: "55555555-5555-4555-8555-555555555555",
  }),
  false,
);
assert.equal(
  nativePushQaDirectConversationAllowed({
    actorId: "66666666-6666-4666-8666-666666666666",
    blocked: false,
    memberIds: [
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
      "77777777-7777-4777-8777-777777777777",
    ],
    profileId: "55555555-5555-4555-8555-555555555555",
  }),
  false,
);

assert.deepEqual(buildNativePushQaAlert("notifications"), {
  body: "Tap to verify app alerts.",
  title: "Test app alert",
  type: "test",
  url: "/notifications",
});
assert.deepEqual(
  buildNativePushQaAlert(
    "latest_message",
    "44444444-4444-4444-8444-444444444444",
  ),
  {
    body: "Tap to verify a message alert.",
    title: "Test message alert",
    type: "test",
    url: "/messages?c=44444444-4444-4444-8444-444444444444",
  },
);
assert.equal(buildNativePushQaAlert("latest_message"), null);
assert.equal(
  buildNativePushQaAlert("latest_message", "/notifications"),
  null,
);
assert.equal(
  parseNativePushQaResponse(202, { scheduled: true }),
  "scheduled",
);
assert.equal(
  parseNativePushQaResponse(200, { suppressed: true }),
  "suppressed",
);
assert.equal(
  parseNativePushQaResponse(409, { reason: "no_message" }),
  "unavailable",
);
assert.equal(
  parseNativePushQaResponse(401, { scheduled: true }),
  null,
);
assert.equal(parseNativePushQaResponse(202, null), null);

assert.deepEqual(
  nativeForegroundAlert({
    body: "Tap to verify app alerts.",
    data: { url: "/messages?c=44444444-4444-4444-8444-444444444444" },
    title: "Test app alert",
  }),
  {
    body: "Tap to verify app alerts.",
    title: "Test app alert",
    url: "/messages?c=44444444-4444-4444-8444-444444444444",
  },
);
assert.deepEqual(
  nativeForegroundAlert({
    body: " ",
    data: { url: "https://example.invalid/phishing" },
    title: " ",
  }),
  {
    body: "Open Notifications to view it.",
    title: "New alert",
    url: "/notifications",
  },
);
assert.equal(
  typeof nativeSystemForegroundAlertPresented,
  "function",
  "the web wrapper must recognize native foreground presentation",
);
assert.equal(
  nativeSystemForegroundAlertPresented({ systemPresented: true }),
  true,
);
assert.equal(
  nativeSystemForegroundAlertPresented({ systemPresented: "true" }),
  false,
);
assert.equal(
  nativeSystemForegroundAlertPresented({
    data: { systemPresented: true },
  }),
  false,
);
assert.equal(nativeSystemForegroundAlertPresented(null), false);

const quietHoursProfile = {
  notification_quiet_hours_enabled: true,
  notification_quiet_hours_end: "17:00",
  notification_quiet_hours_start: "09:00",
  notification_timezone: "UTC",
  notify_message_activity: true,
};

assert.equal(
  allowsNoisyDeliveryNow(
    quietHoursProfile,
    "message",
    new Date("2026-07-24T12:00:00Z"),
  ),
  false,
);
assert.equal(
  allowsNoisyDeliveryNow(
    quietHoursProfile,
    "message",
    new Date("2026-07-24T18:00:00Z"),
  ),
  true,
);
assert.equal(
  allowsNoisyDeliveryNow(
    {
      ...quietHoursProfile,
      notification_quiet_hours_enabled: false,
      notify_message_activity: false,
    },
    "message",
  ),
  false,
);

console.log("PASS native delivery gates fail closed");
console.log("PASS native service-account claims avoid delegated user impersonation");
console.log("PASS controlled test delivery does not open the global delivery gate");
console.log("PASS Android native alerts share one high-importance channel");
console.log("PASS native payloads stay generic and platform-aware");
console.log("PASS native response classification protects device registrations");
console.log("PASS native retry delays are bounded");
console.log("PASS controlled native QA rejects unapproved roles and builds");
console.log("PASS controlled native QA destinations reject client-supplied routes");
console.log("PASS controlled native QA honors message and quiet-hours settings");
console.log("PASS foreground native alerts stay visible and route safely");
