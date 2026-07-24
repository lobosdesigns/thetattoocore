import type { FcmResponseKind } from "./sender-core";

export type NativePushQaTarget = "latest_message" | "notifications";
export type NativePushQaDeliveryOutcome =
  | "accepted"
  | "device"
  | "retry";
export type NativePushQaResponse =
  | NativePushQaDeliveryOutcome
  | "suppressed"
  | "unavailable";

export type NativePushQaAlert = {
  body: string;
  title: string;
  type: "test";
  url: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxRequestBodyBytes = 512;

export function nativePushQaDeliveryOutcome(
  result: FcmResponseKind | "disabled",
): NativePushQaDeliveryOutcome {
  if (result === "success") return "accepted" as const;
  if (result === "token") return "device" as const;

  return "retry" as const;
}

export function nativePushQaDeliveryStatus(
  outcome: NativePushQaDeliveryOutcome,
) {
  if (outcome === "accepted") return 202 as const;
  if (outcome === "device") return 409 as const;

  return 503 as const;
}

export function parseNativePushQaResponse(
  status: number,
  value: unknown,
): NativePushQaResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;

  if (status === 202 && payload.accepted === true) return "accepted";
  if (status === 200 && payload.suppressed === true) return "suppressed";

  if (status === 409) {
    if (payload.reason === "no_message") return "unavailable";
    if (payload.reason === "device") return "device";
  }

  if (status === 503 && payload.reason === "retry") return "retry";

  return null;
}

export function parseNativePushQaTarget(
  value: unknown,
): NativePushQaTarget | null {
  if (value === undefined || value === "notifications") {
    return "notifications";
  }

  return value === "latest_message" ? value : null;
}

export function parseNativePushQaRequest(
  value: unknown,
): NativePushQaTarget | null {
  if (value === undefined) return "notifications";
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload);

  if (keys.some((key) => key !== "target")) return null;

  return parseNativePushQaTarget(payload.target);
}

export async function readNativePushQaTarget(request: Request) {
  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maxRequestBodyBytes
  ) {
    return null;
  }

  if (!request.body) return "notifications" as const;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytesRead = 0;

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      bytesRead += chunk.value.byteLength;

      if (bytesRead > maxRequestBodyBytes) {
        await reader.cancel();
        return null;
      }

      body += decoder.decode(chunk.value, { stream: true });
    }

    body += decoder.decode();
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  if (!body.trim()) return "notifications" as const;

  try {
    return parseNativePushQaRequest(JSON.parse(body) as unknown);
  } catch {
    return null;
  }
}

export function nativePushQaDirectConversationAllowed({
  actorId,
  blocked,
  memberIds,
  profileId,
}: {
  actorId: string;
  blocked: boolean;
  memberIds: readonly string[];
  profileId: string;
}) {
  const uniqueMemberIds = new Set(memberIds);

  return (
    !blocked &&
    actorId !== profileId &&
    uniqueMemberIds.size === 2 &&
    uniqueMemberIds.has(profileId) &&
    uniqueMemberIds.has(actorId)
  );
}

export function buildNativePushQaAlert(
  target: NativePushQaTarget,
  conversationId?: unknown,
): NativePushQaAlert | null {
  if (target === "notifications") {
    return {
      body: "Tap to verify app alerts.",
      title: "Test app alert",
      type: "test",
      url: "/notifications",
    };
  }

  if (
    typeof conversationId !== "string" ||
    !uuidPattern.test(conversationId)
  ) {
    return null;
  }

  return {
    body: "Tap to verify a message alert.",
    title: "Test message alert",
    type: "test",
    url: `/messages?c=${encodeURIComponent(conversationId)}`,
  };
}
