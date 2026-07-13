"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function StoryCreateButton({ isSignedIn }: { isSignedIn: boolean }) {
  const className =
    "flex h-20 min-w-20 flex-col items-center justify-center rounded-md border border-dashed border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] px-3 text-center";

  if (!isSignedIn) {
    return (
      <Link
        aria-label="Sign in to add a Story"
        className={className}
        href="/login?return_to=%2F%23stories"
      >
        <Sparkles className="size-4 text-[var(--gold)]" />
        <span className="mt-1 text-[11px] font-bold text-[var(--muted)]">
          Add
        </span>
        <span className="text-[10px] font-semibold uppercase text-[var(--muted-strong)]">
          Story
        </span>
      </Link>
    );
  }

  return (
    <button
      aria-label="Add a Story"
      className={className}
      onClick={() => {
        window.history.replaceState(null, "", "#stories");
        window.dispatchEvent(
          new CustomEvent("ttc-open-composer", {
            detail: { mode: "stories" },
          }),
        );
      }}
      type="button"
    >
      <Sparkles className="size-4 text-[var(--gold)]" />
      <span className="mt-1 text-[11px] font-bold text-[var(--muted)]">
        Add
      </span>
      <span className="text-[10px] font-semibold uppercase text-[var(--muted-strong)]">
        Story
      </span>
    </button>
  );
}
