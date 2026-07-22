"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { notificationPathOrFallback } from "@/lib/notification-route";

type NativePlatform = "android" | "ios";

type NativeNotificationContextValue = {
  disable: () => Promise<void>;
  enable: () => Promise<"denied" | "enabled">;
  enabled: boolean;
  supported: boolean;
};

const NativeNotificationContext = createContext<NativeNotificationContextValue>({
  disable: async () => undefined,
  enable: async () => "denied",
  enabled: false,
  supported: false,
});

const installationIdKey = "ttc_native_push_installation_id";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function nativeRuntime(setupEnabled: boolean) {
  if (!setupEnabled) return null;

  const { Capacitor } = await import("@capacitor/core");

  if (
    !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable("FirebaseMessaging")
  ) {
    return null;
  }

  const platform = Capacitor.getPlatform();

  if (platform !== "android" && platform !== "ios") return null;
  const nativePlatform = platform as NativePlatform;

  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  const support = await FirebaseMessaging.isSupported();

  if (!support.isSupported) return null;

  return { messaging: FirebaseMessaging, platform: nativePlatform };
}

function installationId() {
  const existing = localStorage.getItem(installationIdKey);

  if (existing && uuidPattern.test(existing)) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(installationIdKey, created);
  return created;
}

async function saveDeviceToken(platform: NativePlatform, token: string) {
  const response = await fetch("/api/push/devices", {
    body: JSON.stringify({
      installationId: installationId(),
      platform,
      token,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error("Device registration failed.");
}

async function removeDeviceToken(platform: NativePlatform) {
  const response = await fetch("/api/push/devices", {
    body: JSON.stringify({
      installationId: installationId(),
      platform,
    }),
    headers: { "content-type": "application/json" },
    method: "DELETE",
  });

  if (!response.ok) throw new Error("Device registration update failed.");
}

async function deviceRegistrationEnabled(platform: NativePlatform) {
  const query = new URLSearchParams({
    installationId: installationId(),
    platform,
  });
  const response = await fetch(`/api/push/devices?${query}`, {
    cache: "no-store",
  });

  if (response.status === 401) return false;
  if (!response.ok) throw new Error("Device registration status failed.");

  const payload = (await response.json()) as { enabled?: unknown };
  return payload.enabled === true;
}

function tappedNotificationPath(notification: { data?: unknown }) {
  const data = notification.data;

  if (!data || typeof data !== "object" || !("url" in data)) {
    return "/notifications";
  }

  return notificationPathOrFallback((data as { url?: unknown }).url);
}

export function NativeNotificationProvider({
  children,
  setupEnabled,
}: {
  children: React.ReactNode;
  setupEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (!setupEnabled) return;

    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    async function keepHandle(handle: { remove: () => Promise<void> }) {
      if (cancelled) {
        await handle.remove();
        return;
      }

      handles.push(handle);
    }

    void nativeRuntime(setupEnabled)
      .then(async (runtime) => {
        if (!runtime || cancelled) return;

        setSupported(true);
        await keepHandle(
          await runtime.messaging.addListener(
            "notificationActionPerformed",
            (event) => {
              router.push(tappedNotificationPath(event.notification));
            },
          ),
        );

        await keepHandle(
          await runtime.messaging.addListener("tokenReceived", (event) => {
            if (enabledRef.current) {
              void saveDeviceToken(runtime.platform, event.token).catch(
                () => undefined,
              );
            }
          }),
        );

        const savedEnabled = await deviceRegistrationEnabled(runtime.platform);

        if (cancelled) return;

        enabledRef.current = savedEnabled;
        setEnabled(savedEnabled);

        if (!savedEnabled) return;

        const permission = await runtime.messaging.checkPermissions();

        if (permission.receive !== "granted") {
          enabledRef.current = false;
          setEnabled(false);
          await removeDeviceToken(runtime.platform).catch(() => undefined);
          return;
        }

        if (cancelled) return;

        const { token } = await runtime.messaging.getToken();
        await saveDeviceToken(runtime.platform, token);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });

    return () => {
      cancelled = true;
      for (const handle of handles) void handle.remove();
    };
  }, [router, setupEnabled]);

  const enable = useCallback(async () => {
    const runtime = await nativeRuntime(setupEnabled);

    if (!runtime) throw new Error("Device alerts are unavailable.");

    let permission = await runtime.messaging.checkPermissions();

    if (
      permission.receive === "prompt" ||
      permission.receive === "prompt-with-rationale"
    ) {
      permission = await runtime.messaging.requestPermissions();
    }

    if (permission.receive !== "granted") return "denied" as const;

    const { token } = await runtime.messaging.getToken();
    await saveDeviceToken(runtime.platform, token);
    enabledRef.current = true;
    setEnabled(true);

    return "enabled" as const;
  }, [setupEnabled]);

  const disable = useCallback(async () => {
    const runtime = await nativeRuntime(setupEnabled);

    if (!runtime) throw new Error("Device alerts are unavailable.");

    enabledRef.current = false;
    let removalError: unknown;

    try {
      await removeDeviceToken(runtime.platform);
    } catch (error) {
      removalError = error;
    }

    try {
      await runtime.messaging.deleteToken();
    } catch (error) {
      removalError ??= error;
    }

    setEnabled(false);

    if (removalError) throw removalError;
  }, [setupEnabled]);

  const value = useMemo(
    () => ({ disable, enable, enabled, supported }),
    [disable, enable, enabled, supported],
  );

  return (
    <NativeNotificationContext.Provider value={value}>
      {children}
    </NativeNotificationContext.Provider>
  );
}

export function useNativeNotificationSetup() {
  return useContext(NativeNotificationContext);
}
