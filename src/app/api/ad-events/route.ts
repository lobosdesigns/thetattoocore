import { checkRateLimit, noStoreJson, rateLimitedJson } from "@/lib/http/reliability";
import { createClient } from "@/lib/supabase/server";

const placements = new Set(["4u", "gossip", "stuff", "merch"]);
const maxEventBodyBytes = 2048;

function hasSafeJsonBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  return (
    contentType.startsWith("application/json") &&
    Number.isFinite(contentLength) &&
    contentLength <= maxEventBodyBytes
  );
}

export async function POST(request: Request) {
  const limit = checkRateLimit({
    limit: 120,
    request,
    scope: "ad-event",
    windowMs: 60_000,
  });

  if (limit.limited) {
    return rateLimitedJson(limit.retryAfterSeconds);
  }

  if (!hasSafeJsonBody(request)) {
    return noStoreJson({ error: "Invalid event." }, { status: 400 });
  }
  let payload: {
    campaign_id?: unknown;
    placement?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid event." }, { status: 400 });
  }

  const campaignId =
    typeof payload.campaign_id === "string" ? payload.campaign_id : "";
  const placement = typeof payload.placement === "string" ? payload.placement : "";

  if (!campaignId || !placements.has(placement)) {
    return noStoreJson({ error: "Invalid event." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  const { error } = await supabase.from("ad_events").insert({
    campaign_id: campaignId,
    event_type: "impression",
    placement,
    viewer_id: viewerId,
  });

  if (error) {
    return noStoreJson({ error: "Event rejected." }, { status: 400 });
  }

  return noStoreJson({ ok: true });
}
