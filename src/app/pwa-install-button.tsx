"use client";

import { useEffect, useState } from "react";
import {
  pwaInstallReadyEvent,
  pwaInstallUnavailableEvent,
} from "./pwa-install-suppressor";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function PwaInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncInstallState = () => {
      setCanInstall(Boolean(window.ttcBeforeInstallPrompt) && !isStandalone());
    };

    syncInstallState();
    window.addEventListener(pwaInstallReadyEvent, syncInstallState);
    window.addEventListener(pwaInstallUnavailableEvent, syncInstallState);
    window.addEventListener("appinstalled", syncInstallState);

    return () => {
      window.removeEventListener(pwaInstallReadyEvent, syncInstallState);
      window.removeEventListener(pwaInstallUnavailableEvent, syncInstallState);
      window.removeEventListener("appinstalled", syncInstallState);
    };
  }, []);

  if (!canInstall) {
    return (
      <p className="text-xs leading-5 text-[var(--muted-strong)]">
        Install becomes available when this browser supports it and the app is
        not already installed.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
        onClick={async () => {
          const installPrompt = window.ttcBeforeInstallPrompt;
          if (!installPrompt) return;

          await installPrompt.prompt();
          const choice = await installPrompt.userChoice;
          window.ttcBeforeInstallPrompt = undefined;
          setCanInstall(false);
          setMessage(
            choice.outcome === "accepted"
              ? "Install started."
              : "Install dismissed. You can keep using the browser version.",
          );
        }}
        type="button"
      >
        Install app
      </button>
      {message ? <p className="text-xs text-[var(--muted-strong)]">{message}</p> : null}
    </div>
  );
}
