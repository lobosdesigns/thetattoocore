"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    ttcBeforeInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export const pwaInstallReadyEvent = "ttc:pwa-install-ready";
export const pwaInstallUnavailableEvent = "ttc:pwa-install-unavailable";

export function PwaInstallSuppressor() {
  useEffect(() => {
    const suppressInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;

      installEvent.preventDefault();
      window.ttcBeforeInstallPrompt = installEvent;
      window.dispatchEvent(new Event(pwaInstallReadyEvent));
    };
    const clearInstallPrompt = () => {
      window.ttcBeforeInstallPrompt = undefined;
      window.dispatchEvent(new Event(pwaInstallUnavailableEvent));
    };

    window.addEventListener("beforeinstallprompt", suppressInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", suppressInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  return null;
}
