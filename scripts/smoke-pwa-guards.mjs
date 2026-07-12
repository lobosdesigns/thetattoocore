import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
const suppressor = readFileSync("src/app/pwa-install-suppressor.tsx", "utf8");
const installButton = readFileSync("src/app/pwa-install-button.tsx", "utf8");
const registrar = readFileSync("src/app/service-worker-registrar.tsx", "utf8");
const notificationPrefs = readFileSync("src/lib/notifications.ts", "utf8");
const serviceWorker = readFileSync("public/sw.js", "utf8");
const allClientPwaSource = [suppressor, installButton, registrar].join("\n");

const checks = [
  {
    label: "root layout registers service worker and suppresses automatic install sheet",
    ok:
      layout.includes("<ServiceWorkerRegistrar />") &&
      layout.includes("<PwaInstallSuppressor />"),
  },
  {
    label: "installed app shortcuts include launch columns and alerts",
    ok:
      manifest.includes('"start_url": "/login"') &&
      manifest.includes('"name": "4U"') &&
      manifest.includes('"url": "/#feed"') &&
      manifest.includes('"name": "DM"') &&
      manifest.includes('"url": "/messages"') &&
      manifest.includes('"name": "Alerts"') &&
      manifest.includes('"url": "/notifications"') &&
      manifest.includes('"name": "Merch"') &&
      manifest.includes('"url": "/#merch"'),
  },
  {
    label: "automatic install prompt is intercepted instead of shown during browsing",
    ok:
      suppressor.includes('window.addEventListener("beforeinstallprompt"') &&
      suppressor.includes("installEvent.preventDefault()") &&
      suppressor.includes("window.ttcBeforeInstallPrompt = installEvent"),
  },
  {
    label: "install prompt can only launch from deliberate install button",
    ok:
      installButton.includes("await installPrompt.prompt()") &&
      installButton.includes("Install app") &&
      installButton.includes("Install dismissed. You can keep using the browser version."),
  },
  {
    label: "service worker registers without blocking normal browsing",
    ok:
      registrar.includes('navigator.serviceWorker.register("/sw.js")') &&
      registrar.includes("Installability should not block normal browsing."),
  },
  {
    label: "push display is prepared but push subscription is not enabled yet",
    ok:
      serviceWorker.includes('self.addEventListener("push"') &&
      serviceWorker.includes("showNotification") &&
      !allClientPwaSource.includes("Notification.requestPermission") &&
      !allClientPwaSource.includes(".pushManager.subscribe") &&
      !allClientPwaSource.includes("PushManager"),
  },
  {
    label: "future noisy push/email delivery has preference and quiet-hour helpers",
    ok:
      notificationPrefs.includes("export function allowsNoisyDeliveryNow") &&
      notificationPrefs.includes("allowsInAppNotification(profile, category)") &&
      notificationPrefs.includes("!isNotificationQuietHour(profile, now)") &&
      notificationPrefs.includes("notificationPreferenceSelect") &&
      notificationPrefs.includes("notification_timezone"),
  },
  {
    label: "notification clicks stay on same-origin safe paths",
    ok:
      serviceWorker.includes('self.addEventListener("notificationclick"') &&
      serviceWorker.includes("safeNotificationPath") &&
      serviceWorker.includes("url.origin !== self.location.origin") &&
      serviceWorker.includes('return "/notifications"'),
  },
  {
    label: "notification click routes are limited to user-facing paths",
    ok:
      serviceWorker.includes("allowedNotificationPath") &&
      serviceWorker.includes("allowedPaths") &&
      serviceWorker.includes("allowedPrefixes") &&
      serviceWorker.includes('"/messages"') &&
      serviceWorker.includes('"/p/"'),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} PWA guard smoke check(s) failed.`);
  process.exit(1);
}
