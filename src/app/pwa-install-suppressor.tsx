"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  preventDefault: () => void;
};

export function PwaInstallSuppressor() {
  useEffect(() => {
    const suppressInstallPrompt = (event: Event) => {
      (event as BeforeInstallPromptEvent).preventDefault();
    };

    window.addEventListener("beforeinstallprompt", suppressInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", suppressInstallPrompt);
    };
  }, []);

  return null;
}
