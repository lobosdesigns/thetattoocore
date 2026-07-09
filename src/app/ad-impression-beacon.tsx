"use client";

import { useEffect } from "react";

export function AdImpressionBeacon({
  campaignId,
  placement,
}: {
  campaignId: string;
  placement: "4u" | "gossip" | "stuff";
}) {
  useEffect(() => {
    const body = JSON.stringify({
      campaign_id: campaignId,
      placement,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/ad-events",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch("/api/ad-events", {
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  }, [campaignId, placement]);

  return null;
}
