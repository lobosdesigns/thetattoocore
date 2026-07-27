import { checkRateLimit, noStoreRedirect } from "@/lib/http/reliability";
import { createClient } from "@/lib/supabase/server";

const placements = new Set(["4u", "gossip", "stuff", "merch"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaign_id") ?? "";
  const placement = url.searchParams.get("placement") ?? "";
  const fallback = new URL("/", request.url);

  if (!campaignId || !placements.has(placement)) {
    return noStoreRedirect(fallback, { status: 303 });
  }

  const limit = checkRateLimit({
    limit: 60,
    request,
    scope: "ad-click",
    windowMs: 60_000,
  });

  if (limit.limited) {
    return noStoreRedirect(fallback, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 303,
    });
  }

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("id, target_url, ad_campaign_placements!inner(placement)")
    .eq("id", campaignId)
    .eq("status", "active")
    .in("payment_status", ["paid", "waived"])
    .eq("payment_dispute_hold", false)
    .eq("ad_campaign_placements.placement", placement)
    .maybeSingle<{ id: string; target_url: string | null }>();

  if (!campaign?.target_url) {
    return noStoreRedirect(fallback, { status: 303 });
  }

  let target: URL;

  try {
    target = new URL(campaign.target_url);
  } catch {
    return noStoreRedirect(fallback, { status: 303 });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return noStoreRedirect(fallback, { status: 303 });
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  await supabase.from("ad_events").insert({
    campaign_id: campaignId,
    event_type: "click",
    placement,
    viewer_id: viewerId,
  });

  return noStoreRedirect(target, { status: 303 });
}
