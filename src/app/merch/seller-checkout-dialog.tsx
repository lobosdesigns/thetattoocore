"use client";

import { Capacitor } from "@capacitor/core";
import { ExternalLink, X } from "lucide-react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => element.getClientRects().length > 0);
}

export function SellerCheckoutDialog({
  checkoutUrl,
  sellerName,
}: {
  checkoutUrl: string;
  sellerName: string;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setErrorMessage(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = focusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable.at(-1);
      const focused = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      if (!dialogRef.current.contains(focused)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDialog, isOpen]);

  const openSellerCheckout = (event: MouseEvent<HTMLAnchorElement>) => {
    setErrorMessage(null);

    if (!Capacitor.isNativePlatform()) return;

    event.preventDefault();

    void (async () => {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: checkoutUrl });
        closeDialog();
      } catch {
        setErrorMessage("Could not open seller checkout. Try again.");
      }
    })();
  };

  return (
    <>
      <button
        ref={openerRef}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        type="button"
      >
        <ExternalLink className="size-4" />
        Buy from seller
      </button>

      {isOpen ? (
        <div className="ttc-safe-modal fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--foreground)_58%,transparent)] px-3 py-6 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-lg items-center">
            <section
              ref={dialogRef}
              aria-describedby="seller-checkout-description"
              aria-labelledby="seller-checkout-title"
              aria-modal="true"
              className="w-full overflow-hidden rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] shadow-2xl"
              role="dialog"
              tabIndex={-1}
            >
              <header className="flex items-center justify-between gap-3 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--brand-gold)]">
                    <ExternalLink className="size-5" />
                  </span>
                  <p
                    className="truncate text-base font-bold"
                    id="seller-checkout-title"
                  >
                    Continue to seller checkout
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  aria-label="Close seller checkout"
                  className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)]"
                  onClick={closeDialog}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </header>

              <div className="p-4">
                <p
                  className="break-words text-sm leading-6 text-[var(--muted)]"
                  id="seller-checkout-description"
                >
                  You are leaving TheTattooCore to buy directly from{" "}
                  <strong className="text-[var(--foreground)]">{sellerName}</strong>.
                  {" "}{sellerName} is responsible for payment processing, taxes,
                  shipping, returns, refunds, disputes, and purchase support.
                </p>
                {errorMessage ? (
                  <p
                    className="mt-3 rounded-md border border-[color-mix(in_srgb,#ef4444_38%,var(--card-rim))] bg-[color-mix(in_srgb,#ef4444_8%,var(--paper-soft))] p-3 text-sm text-[var(--foreground)]"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    className="h-11 rounded-md border border-[var(--card-rim)] px-4 text-sm font-semibold"
                    onClick={closeDialog}
                    type="button"
                  >
                    Cancel
                  </button>
                  <a
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                    href={checkoutUrl}
                    onClick={openSellerCheckout}
                    rel="ugc nofollow noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">
                      Continue to {sellerName}
                    </span>
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
