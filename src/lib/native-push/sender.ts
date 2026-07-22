import { createClient } from "@supabase/supabase-js";
import {
  allowsNoisyDeliveryNow,
  type NotificationPreferenceProfile,
} from "../notifications";
import { notificationPathOrFallback } from "../notification-route";
import {
  buildNativeMessage,
  classifyFcmResponse,
  nativePushDeliveryReady,
  type NativePushDeliveryEnvironment,
  retryDelaySeconds,
} from "./sender-core";

type NativeDeliveryJob = {
  attempt_count: number;
  banned_at: string | null;
  device_active: boolean;
  device_id: string;
  device_last_seen_at: string;
  device_platform: "android" | "ios";
  device_token: string;
  device_token_hash: string;
  job_id: string;
  lease_token: string;
  message_id: string | null;
  notification_href: string | null;
  notification_id: string;
  notification_quiet_hours_enabled: boolean;
  notification_quiet_hours_end: string;
  notification_quiet_hours_start: string;
  notification_timezone: string;
  notification_type: string;
  notify_message_activity: boolean;
  notify_push_enabled: boolean;
  recipient_id: string;
  suspended_at: string | null;
};

type NativeDeliveryStats = {
  claimed: number;
  completed: number;
  retried: number;
  status: "claim_failed" | "disabled" | "ready";
  suppressed: number;
};

type AccessTokenCache = {
  clientEmail: string;
  expiresAt: number;
  token: string;
};

type NativePushRpcClient = {
  rpc(
    functionName:
      | "claim_native_push_delivery_batch"
      | "complete_native_push_delivery"
      | "retry_native_push_delivery"
      | "suppress_native_push_delivery",
    parameters: Record<string, boolean | number | string | null>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

let accessTokenCache: AccessTokenCache | null = null;

function base64Url(value: Uint8Array | string) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function privateKeyBytes(value: string) {
  const normalized = value
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(normalized);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function serviceAccessToken(
  env: NativePushDeliveryEnvironment,
  fetcher: typeof fetch,
) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    accessTokenCache?.clientEmail === clientEmail &&
    accessTokenCache.expiresAt > nowSeconds + 60
  ) {
    return accessTokenCache.token;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSeconds + 3600,
      iat: nowSeconds,
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      sub: clientEmail,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(env.FIREBASE_PRIVATE_KEY!),
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error("Native delivery credentials were rejected.");
  }

  accessTokenCache = {
    clientEmail,
    expiresAt: nowSeconds + Math.max(300, payload.expires_in ?? 3600),
    token: payload.access_token,
  };

  return payload.access_token;
}

function preferenceProfile(job: NativeDeliveryJob): NotificationPreferenceProfile {
  return {
    notification_quiet_hours_enabled:
      job.notification_quiet_hours_enabled,
    notification_quiet_hours_end: job.notification_quiet_hours_end,
    notification_quiet_hours_start: job.notification_quiet_hours_start,
    notification_timezone: job.notification_timezone,
    notify_message_activity: job.notify_message_activity,
  };
}

async function updateJob(
  supabase: NativePushRpcClient,
  functionName:
    | "complete_native_push_delivery"
    | "retry_native_push_delivery"
    | "suppress_native_push_delivery",
  parameters: Record<string, boolean | number | string | null>,
) {
  const { data, error } = await supabase.rpc(functionName, parameters);

  return !error && data === true;
}

export async function drainNativePushBatch(
  env: NativePushDeliveryEnvironment,
  options: { fetcher?: typeof fetch; now?: Date } = {},
): Promise<NativeDeliveryStats> {
  const stats: NativeDeliveryStats = {
    claimed: 0,
    completed: 0,
    retried: 0,
    status: "disabled",
    suppressed: 0,
  };

  if (!nativePushDeliveryReady(env)) return stats;

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  ) as unknown as NativePushRpcClient;
  const { data, error } = await supabase.rpc(
    "claim_native_push_delivery_batch",
    {
      p_lease_seconds: 60,
      p_limit: 25,
    },
  );

  if (error) return { ...stats, status: "claim_failed" };

  const jobs = (data ?? []) as NativeDeliveryJob[];
  stats.claimed = jobs.length;
  stats.status = "ready";

  if (jobs.length === 0) return stats;

  const fetcher = options.fetcher ?? fetch;
  let accessToken: string;

  try {
    accessToken = await serviceAccessToken(env, fetcher);
  } catch {
    await Promise.all(
      jobs.map((job) =>
        updateJob(supabase, "retry_native_push_delivery", {
          p_count_attempt: true,
          p_error_code: "credentials",
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_retry_after_seconds: 900,
          p_retryable: true,
        }),
      ),
    );
    stats.retried = jobs.length;
    return stats;
  }

  await Promise.all(
    jobs.map(async (job) => {
      const suppress = async (
        reason:
          | "account_restricted"
          | "device_inactive"
          | "invalid_token"
          | "preference",
        deactivateDevice = false,
      ) => {
        const updated = await updateJob(
          supabase,
          "suppress_native_push_delivery",
          {
            p_deactivate_device: deactivateDevice,
            p_device_token_hash: deactivateDevice
              ? job.device_token_hash
              : null,
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_reason: reason,
          },
        );

        if (updated) stats.suppressed += 1;
      };

      if (
        job.notification_type !== "message" ||
        !job.message_id
      ) {
        const updated = await updateJob(
          supabase,
          "retry_native_push_delivery",
          {
            p_count_attempt: true,
            p_error_code: "payload",
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_retry_after_seconds: 300,
            p_retryable: false,
          },
        );
        if (updated) stats.suppressed += 1;
        return;
      }

      if (!job.device_active) {
        await suppress("device_inactive");
        return;
      }

      if (job.banned_at || job.suspended_at) {
        await suppress("account_restricted");
        return;
      }

      if (
        !job.notify_push_enabled ||
        !job.notify_message_activity
      ) {
        await suppress("preference");
        return;
      }

      if (
        !allowsNoisyDeliveryNow(
          preferenceProfile(job),
          "message",
          options.now ?? new Date(),
        )
      ) {
        const updated = await updateJob(
          supabase,
          "retry_native_push_delivery",
          {
            p_count_attempt: false,
            p_error_code: "quiet_hours",
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_retry_after_seconds: 900,
            p_retryable: true,
          },
        );
        if (updated) stats.retried += 1;
        return;
      }

      let response: Response;
      let payload: unknown = null;

      try {
        response = await fetcher(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID!)}/messages:send`,
          {
            body: JSON.stringify(
              buildNativeMessage({
                notificationId: job.notification_id,
                platform: job.device_platform,
                token: job.device_token,
                url: notificationPathOrFallback(job.notification_href),
              }),
            ),
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json",
            },
            method: "POST",
            signal: AbortSignal.timeout(8_000),
          },
        );
        payload = await response.json().catch(() => null);
      } catch {
        const updated = await updateJob(
          supabase,
          "retry_native_push_delivery",
          {
            p_count_attempt: true,
            p_error_code: "temporary",
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
            p_retry_after_seconds: retryDelaySeconds(
              job.attempt_count,
              null,
            ),
            p_retryable: true,
          },
        );
        if (updated) stats.retried += 1;
        return;
      }

      const responseKind = classifyFcmResponse(response.status, payload);

      if (responseKind === "success") {
        const updated = await updateJob(
          supabase,
          "complete_native_push_delivery",
          {
            p_job_id: job.job_id,
            p_lease_token: job.lease_token,
          },
        );
        if (updated) stats.completed += 1;
        return;
      }

      if (responseKind === "token") {
        await suppress("invalid_token", true);
        return;
      }

      const retryable =
        responseKind === "credentials" ||
        responseKind === "temporary" ||
        responseKind === "unknown";
      const errorCode =
        responseKind === "credentials"
          ? "credentials"
          : responseKind === "payload"
            ? "payload"
            : response.status === 429
              ? "rate_limited"
              : responseKind === "temporary"
                ? "temporary"
                : "unknown";
      const updated = await updateJob(
        supabase,
        "retry_native_push_delivery",
        {
          p_count_attempt: true,
          p_error_code: errorCode,
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_retry_after_seconds: retryable
            ? retryDelaySeconds(
                job.attempt_count,
                response.headers.get("retry-after"),
              )
            : 300,
          p_retryable: retryable,
        },
      );

      if (updated) {
        if (retryable) stats.retried += 1;
        else stats.suppressed += 1;
      }
    }),
  );

  return stats;
}
