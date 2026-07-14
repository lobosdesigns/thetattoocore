"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, LoaderCircle, BellOff } from "lucide-react";

const publicPushKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

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

  if (!response.ok) throw new Error("Push setup failed.");
}

export function PushSubscriptionControl() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [supported, setSupported] = useState(false);
  const readyForSetup = useMemo(() => Boolean(publicPushKey), []);

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
        setMessage("Push notifications are being prepared.");
        return;
      }

      if (!hasSupport) {
        setMessage("This browser does not support installed app push.");
        return;
      }

      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => {
          if (!cancelled) setEnabled(Boolean(subscription));
        })
        .catch(() => {
          if (!cancelled) setMessage("Push status could not be checked.");
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
        setMessage("Push permission was not enabled.");
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
      setMessage("Push is enabled for this browser.");
    } catch {
      setMessage("Push setup could not be completed.");
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
        await fetch("/api/push/subscriptions", {
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        });
        await subscription.unsubscribe();
      }

      setEnabled(false);
      setMessage("Push is off for this browser.");
    } catch {
      setMessage("Push could not be turned off.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ttc-surface mt-3 rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
            Installed app push
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {message || (enabled ? "Enabled for this browser." : "Ready when you turn it on.")}
          </p>
        </div>
        {supported ? (
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
