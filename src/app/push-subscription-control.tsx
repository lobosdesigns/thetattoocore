"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, LoaderCircle, BellOff } from "lucide-react";

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
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [supported, setSupported] = useState(false);
  const readyForSetup = useMemo(
    () => deviceAlertSetupEnabled && Boolean(publicPushKey),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const hasSupport =
        readyForSetup &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setSupported(hasSupport);

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
        .then((subscription) => {
          if (!cancelled) setEnabled(Boolean(subscription));
        })
        .catch(() => {
          if (!cancelled) setMessage("App alert status could not be checked.");
        });
    });

    return () => {
      cancelled = true;
    };
  }, [readyForSetup]);

  async function enablePush() {
    setPending(true);
    setMessage("");

    try {
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
      setEnabled(true);
      setMessage("Device alert preference saved. Keep checking Notifications for now.");
    } catch {
      setMessage("App alert setup could not be completed.");
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);
    setMessage("");

    try {
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

      setEnabled(false);
      setMessage("Device alert preference is off. Keep checking Notifications for now.");
    } catch {
      setMessage("App alerts could not be turned off.");
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
                : fallbackMessage)}
          </p>
        </div>
        {supported && !permissionBlocked ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-xs font-bold text-[var(--background)] disabled:opacity-60"
            disabled={pending}
            onClick={enabled ? disablePush : enablePush}
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
        ) : null}
      </div>
    </div>
  );
}
