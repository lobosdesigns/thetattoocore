import assert from "node:assert/strict";
import {
  buildNativeMessage,
  classifyFcmResponse,
  nativePushDeliveryReady,
  nativePushSenderReady,
  retryDelaySeconds,
} from "../src/lib/native-push/sender-core.ts";
import {
  nativePushQaBuildAllowed,
  nativePushQaRoleAllowed,
} from "../src/lib/native-push/qa-access.ts";

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

assert.equal(android.message.notification.title, "New message");
assert.equal(android.message.notification.body, "You have a new message.");
assert.equal(android.message.android.priority, "high");
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
assert.equal(nativePushQaBuildAllowed("android", "1.0.2", "3"), true);
assert.equal(nativePushQaBuildAllowed("android", "1.0.1", "2"), false);
assert.equal(nativePushQaBuildAllowed("android", "1.0.2", "4"), false);
assert.equal(nativePushQaBuildAllowed("ios", "1.0", "4"), true);
assert.equal(nativePushQaBuildAllowed("ios", "1.0", "3"), false);

console.log("PASS native delivery gates fail closed");
console.log("PASS controlled test delivery does not open the global delivery gate");
console.log("PASS native payloads stay generic and platform-aware");
console.log("PASS native response classification protects device registrations");
console.log("PASS native retry delays are bounded");
console.log("PASS controlled native QA rejects unapproved roles and builds");
