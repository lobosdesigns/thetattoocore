import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const placements = new Set(["4u", "gossip", "stuff"]);

export async function POST(request: Request) {
  let payload: {
    campaign_id?: unknown;
    placement?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const campaignId =
    typeof payload.campaign_id === "string" ? payload.campaign_id : "";
  const placement = typeof payload.placement === "string" ? payload.placement : "";

  if (!campaignId || !placements.has(placement)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
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
    return NextResponse.json({ error: "Event rejected." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
