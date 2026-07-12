"use client";

import { Printer } from "lucide-react";

export function PrintReceiptButton() {
  return (
    <button
      className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
      onClick={() => window.print()}
      type="button"
    >
      <Printer className="size-4" />
      Print receipt
    </button>
  );
}
