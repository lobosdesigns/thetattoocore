import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const suppressor = readFileSync("src/app/pwa-install-suppressor.tsx", "utf8");
const installButton = readFileSync("src/app/pwa-install-button.tsx", "utf8");
const registrar = readFileSync("src/app/service-worker-registrar.tsx", "utf8");
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
