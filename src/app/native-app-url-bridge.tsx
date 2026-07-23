"use client";

import type { PluginListenerHandle } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { nativeAppPathOrNull } from "@/lib/native-app-url";

const nativeAppUrlDedupWindowMs = 1500;

export function NativeAppUrlBridge() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let handle: PluginListenerHandle | null = null;
    let warmEventSeen = false;
    let lastHandled = { at: 0, path: "" };

    function navigate(value: unknown, mode: "push" | "replace") {
      if (cancelled) return;

      const path = nativeAppPathOrNull(value);
      if (!path) return;

      const now = Date.now();
      if (
        lastHandled.path === path &&
        now - lastHandled.at < nativeAppUrlDedupWindowMs
      ) {
        return;
      }

      lastHandled = { at: now, path };

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentPath === path) return;

      if (mode === "replace") {
        router.replace(path);
      } else {
        router.push(path);
      }
    }

    void import("@capacitor/core")
      .then(async ({ Capacitor }) => {
        if (!Capacitor.isNativePlatform() || cancelled) return;

        const { App } = await import("@capacitor/app");
        const createdHandle = await App.addListener("appUrlOpen", (event) => {
          warmEventSeen = true;
          navigate(event.url, "push");
        });

        if (cancelled) {
          await createdHandle.remove();
          return;
        }

        handle = createdHandle;
        const launch = await App.getLaunchUrl();

        if (!warmEventSeen) {
          navigate(launch?.url, "replace");
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, [router]);

  return null;
}
