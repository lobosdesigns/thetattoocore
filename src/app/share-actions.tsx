"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function ShareActions({
  text,
  title,
  url,
}: {
  text: string;
  title: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      await navigator.share({ text, title, url });
      return;
    }

    await copy();
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-md border border-[#d8d1c6] bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[#766d62]">Share</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
          onClick={share}
          type="button"
        >
          <Share2 className="size-4" />
          Share
        </button>
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold"
          onClick={copy}
          type="button"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 truncate rounded-md bg-[#f7f4ef] px-2 py-2 text-xs text-[#766d62]">
        {url}
      </p>
    </div>
  );
}

export function CompactShareButton({
  className = "flex items-center gap-2 text-sm font-medium",
  text,
  title,
  url,
}: {
  className?: string;
  text: string;
  title: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text, title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // User canceled the share sheet or clipboard access was unavailable.
    }
  }

  return (
    <button className={className} onClick={share} type="button">
      {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
