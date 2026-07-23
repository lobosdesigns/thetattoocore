export type NativePushDeliveryEnvironment = {
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TTC_DEVICE_ALERT_SETUP_ENABLED?: string;
  TTC_NATIVE_PUSH_DELIVERY_ENABLED?: string;
  TTC_NATIVE_PUSH_REGISTRATION_ENABLED?: string;
};

export type NativeMessageInput = {
  body?: string;
  notificationId: string;
  platform: "android" | "ios";
  token: string;
  title?: string;
  type?: string;
  url: string;
};

type FcmErrorPayload = {
  error?: {
    details?: Array<{
      "@type"?: string;
      errorCode?: string;
    }>;
    status?: string;
  };
};

export type FcmResponseKind =
  | "credentials"
  | "payload"
  | "success"
  | "temporary"
  | "token"
  | "unknown";

export function nativePushSenderReady(
  env: NativePushDeliveryEnvironment,
) {
  return (
    env.TTC_DEVICE_ALERT_SETUP_ENABLED === "true" &&
    env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED === "true" &&
    Boolean(env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(env.FIREBASE_PROJECT_ID) &&
    Boolean(env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(env.FIREBASE_PRIVATE_KEY)
  );
}

export function nativePushDeliveryReady(
  env: NativePushDeliveryEnvironment,
) {
  return (
    nativePushSenderReady(env) &&
    env.TTC_NATIVE_PUSH_DELIVERY_ENABLED === "true"
  );
}

export function buildNativeMessage({
  body = "You have a new message.",
  notificationId,
  platform,
  token,
  title = "New message",
  type = "message",
  url,
}: NativeMessageInput) {
  const message = {
    data: {
      notificationId,
      type,
      url,
    },
    notification: {
      body,
      title,
    },
    token,
  };

  if (platform === "android") {
    return {
      message: {
        ...message,
        android: {
          collapse_key: notificationId,
          notification: { sound: "default" },
          priority: "high",
        },
      },
    };
  }

  return {
    message: {
      ...message,
      apns: {
        headers: {
          "apns-collapse-id": notificationId,
          "apns-priority": "10",
        },
        payload: {
          aps: { sound: "default" },
        },
      },
    },
  };
}

export function classifyFcmResponse(
  statusCode: number,
  payload: unknown,
): FcmResponseKind {
  if (statusCode >= 200 && statusCode < 300) return "success";

  const error = (payload as FcmErrorPayload | null)?.error;
  const fcmError = error?.details?.find((detail) =>
    detail["@type"]?.endsWith("google.firebase.fcm.v1.FcmError"),
  )?.errorCode;

  if (
    error?.status === "UNREGISTERED" ||
    fcmError === "UNREGISTERED" ||
    (statusCode === 400 && fcmError === "INVALID_ARGUMENT")
  ) {
    return "token";
  }

  if (statusCode === 401 || statusCode === 403) return "credentials";
  if (statusCode === 429 || statusCode >= 500) return "temporary";
  if (statusCode === 400) return "payload";

  return "unknown";
}

export function retryDelaySeconds(
  attemptCount: number,
  retryAfter: string | null,
  now = Date.now(),
) {
  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(3600, Math.max(5, Math.ceil(seconds)));
  }

  if (retryAfter) {
    const retryAt = Date.parse(retryAfter);

    if (Number.isFinite(retryAt) && retryAt > now) {
      return Math.min(3600, Math.max(5, Math.ceil((retryAt - now) / 1000)));
    }
  }

  return Math.min(3600, 15 * 2 ** Math.min(Math.max(attemptCount, 0), 7));
}
