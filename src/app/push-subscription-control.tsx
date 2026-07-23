"use client";

import { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, LoaderCircle, Send } from "lucide-react";
import {
  nativeNotificationSetupFailureMessage,
  useNativeNotificationSetup,
} from "./native-notification-provider";

const publicPushKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
const deviceAlertSetupEnabled =
  process.env.NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED === "true";
const fallbackMessage =
  "Device alerts are being prepared. Keep checking Notifications for now.";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replaceAll("-", "+").replaceAll("_", "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: json.keys?.auth,
      p256dh: json.keys?.p256dh,
    },
  };
}

async function postSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    body: JSON.stringify(subscriptionPayload(subscription)),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error("App alert setup failed.");
}

export function PushSubscriptionControl() {
  const nativeNotifications = useNativeNotificationSetup();
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(false);
  const readyForSetup = useMemo(
    () => deviceAlertSetupEnabled && Boolean(publicPushKey),
    [],
  );
  const enabled = nativeNotifications.supported
    ? nativeNotifications.enabled
    : browserEnabled;
  const supported = nativeNotifications.supported || browserSupported;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (nativeNotifications.supported) {
        setBrowserSupported(false);
        setMessage("");
        setPermissionBlocked(false);
        return;
      }

      const hasSupport =
        readyForSetup &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setBrowserSupported(hasSupport);

      if (!readyForSetup) {
        setMessage(fallbackMessage);
        return;
      }

      if (!hasSupport) {
        setMessage(fallbackMessage);
        return;
      }

      if (Notification.permission === "denied") {
        setPermissionBlocked(true);
        setMessage("Device alerts are blocked in this browser. Keep checking Notifications for now.");
        return;
      }

      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then(async (subscription) => {
          if (!subscription) return false;

          const response = await fetch("/api/push/subscriptions", {
            cache: "no-store",
          });

          if (!response.ok) throw new Error("App alert status failed.");

          const payload = (await response.json()) as { enabled?: unknown };
          return payload.enabled === true;
        })
        .then((isEnabled) => {
          if (!cancelled) setBrowserEnabled(isEnabled);
        })
        .catch(() => {
          if (!cancelled) setMessage("App alert status could not be checked.");
        });
    });

    return () => {
      cancelled = true;
    };
  }, [nativeNotifications.supported, readyForSetup]);

  async function enableAlerts() {
    setPending(true);
    setMessage("");

    try {
      if (nativeNotifications.supported) {
        const result = await nativeNotifications.enable();

        if (result === "denied") {
          setPermissionBlocked(true);
          setMessage(
            "Device alerts are blocked in system settings. Keep checking Notifications for now.",
          );
          return;
        }

        setMessage("Device alert preference saved.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        if (permission === "denied") {
          setPermissionBlocked(true);
        }
        setMessage("Device alerts are still off. Keep checking Notifications for now.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(publicPushKey),
          userVisibleOnly: true,
        }));

      await postSubscription(subscription);
      setBrowserEnabled(true);
      setMessage("Device alert preference saved. Keep checking Notifications for now.");
    } catch (error) {
      setMessage(nativeNotificationSetupFailureMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function disableAlerts() {
    setPending(true);
    setMessage("");

    try {
      if (nativeNotifications.supported) {
        await nativeNotifications.disable();
        setMessage("Device alerts are off.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        });

        if (!response.ok) throw new Error("App alert preference could not be saved.");

        await subscription.unsubscribe();
      }

      setBrowserEnabled(false);
      setMessage("Device alert preference is off. Keep checking Notifications for now.");
    } catch {
      setMessage("App alerts could not be turned off.");
    } finally {
      setPending(false);
    }
  }

  async function sendTestAlert() {
    setPending(true);
    setMessage("");

    try {
      await nativeNotifications.sendTest();
      setMessage("Test alert sent. Lock this device, then tap the alert.");
    } catch {
      setMessage("Test alert could not be sent. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ttc-surface mt-3 rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
            App alerts
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {message ||
              (enabled
                ? "Device alert preference saved. Keep checking Notifications for now."
                : nativeNotifications.supported
                  ? "Turn on alerts for activity you care about."
                  : fallbackMessage)}
          </p>
        </div>
        {supported && !permissionBlocked ? (
          <div className="flex flex-wrap items-center gap-2">
            {enabled && nativeNotifications.testAvailable ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-bold disabled:opacity-60"
                disabled={pending}
                onClick={sendTestAlert}
                type="button"
              >
                <Send className="size-4" />
                Send test
              </button>
            ) : null}
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-bold text-[var(--background)] disabled:opacity-60"
              disabled={pending}
              onClick={enabled ? disableAlerts : enableAlerts}
              type="button"
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : enabled ? (
                <BellOff className="size-4" />
              ) : (
                <BellRing className="size-4" />
              )}
              {enabled ? "Turn off" : "Enable"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
