"use client";

import type { PluginListenerHandle } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { nativeAppPathOrNull } from "@/lib/native-app-url";
import { nativeSessionReturnPath } from "@/lib/native-session";

const nativeAppUrlDedupWindowMs = 1500;
const nativeResumeFallbackMs = 400;
const nativeSessionRetryMs = 2000;

export function NativeAppUrlBridge() {
  const router = useRouter();
  const resumeGuardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let handles: PluginListenerHandle[] = [];
    let warmEventSeen = false;
    let lastHandled = { at: 0, path: "" };
    let appIsActive = true;
    let checkGeneration = 0;
    let activeController: AbortController | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function showResumeGuard() {
      const guard = resumeGuardRef.current;
      if (!guard) return;

      guard.hidden = false;
      guard.setAttribute("aria-hidden", "false");
    }

    function hideResumeGuard() {
      const guard = resumeGuardRef.current;
      if (!guard) return;

      guard.hidden = true;
      guard.setAttribute("aria-hidden", "true");
    }

    function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
      if (timer) clearTimeout(timer);
    }

    function safeLoginHref() {
      const returnTo = nativeSessionReturnPath(window.location.pathname);

      return `/login?return_to=${encodeURIComponent(returnTo)}`;
    }

    function pauseSessionGuard() {
      appIsActive = false;
      checkGeneration += 1;
      activeController?.abort();
      activeController = null;
      clearTimer(fallbackTimer);
      clearTimer(retryTimer);
      fallbackTimer = null;
      retryTimer = null;
      showResumeGuard();
    }

    function retrySessionCheck() {
      if (cancelled || !appIsActive) return;

      clearTimer(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void revalidateSession();
      }, nativeSessionRetryMs);
    }

    function revalidateSession() {
      if (cancelled || !appIsActive || activeController) return;

      showResumeGuard();
      const generation = ++checkGeneration;
      const controller = new AbortController();
      activeController = controller;

      void fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      })
        .then((response) => {
          if (
            cancelled ||
            !appIsActive ||
            generation !== checkGeneration
          ) {
            return;
          }

          if (response.status === 204) {
            router.refresh();
            hideResumeGuard();
            return;
          }

          if (response.status === 401) {
            window.location.replace(safeLoginHref());
            return;
          }

          retrySessionCheck();
        })
        .catch((error: unknown) => {
          if (
            !cancelled &&
            appIsActive &&
            generation === checkGeneration &&
            (!(error instanceof DOMException) || error.name !== "AbortError")
          ) {
            retrySessionCheck();
          }
        })
        .finally(() => {
          if (activeController === controller) {
            activeController = null;
          }
        });
    }

    function resumeSessionGuard(useFallback: boolean) {
      appIsActive = true;
      clearTimer(fallbackTimer);
      fallbackTimer = null;

      if (!useFallback) {
        revalidateSession();
        return;
      }

      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        revalidateSession();
      }, nativeResumeFallbackMs);
    }

    const nativeResumeHandler = () => resumeSessionGuard(false);

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
        const createdHandles = await Promise.all([
          App.addListener("appUrlOpen", (event) => {
            warmEventSeen = true;
            navigate(event.url, "push");
          }),
          App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
              resumeSessionGuard(true);
            } else {
              pauseSessionGuard();
            }
          }),
          App.addListener("pause", pauseSessionGuard),
          App.addListener("resume", () => {
            resumeSessionGuard(true);
          }),
        ]);

        if (cancelled) {
          await Promise.all(createdHandles.map((handle) => handle.remove()));
          return;
        }

        handles = createdHandles;
        window.addEventListener("ttc:native-resume", nativeResumeHandler);
        const launch = await App.getLaunchUrl();

        if (!warmEventSeen) {
          navigate(launch?.url, "replace");
        }

        if (cancelled) {
          window.removeEventListener("ttc:native-resume", nativeResumeHandler);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      checkGeneration += 1;
      activeController?.abort();
      clearTimer(fallbackTimer);
      clearTimer(retryTimer);
      void Promise.all(handles.map((handle) => handle.remove()));
      window.removeEventListener("ttc:native-resume", nativeResumeHandler);
    };
  }, [router]);

  return (
    <div
      ref={resumeGuardRef}
      aria-hidden="true"
      aria-live="polite"
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-[#171412]"
      data-native-session-guard
      hidden
      role="status"
    >
      <span
        aria-hidden="true"
        className="flex size-24 items-center justify-center rounded-full border-2 border-[#c8a55c] bg-[#211c18] text-2xl font-black text-[#fffaf0]"
      >
        TTC
      </span>
      <span className="sr-only">Checking your session</span>
    </div>
  );
}
