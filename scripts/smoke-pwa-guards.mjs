import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
const suppressor = readFileSync("src/app/pwa-install-suppressor.tsx", "utf8");
const installButton = readFileSync("src/app/pwa-install-button.tsx", "utf8");
const registrar = readFileSync("src/app/service-worker-registrar.tsx", "utf8");
const notificationPrefs = readFileSync("src/lib/notifications.ts", "utf8");
const serviceWorker = readFileSync("public/sw.js", "utf8");
const pushControl = readFileSync("src/app/push-subscription-control.tsx", "utf8");
const pushRoute = readFileSync("src/app/api/push/subscriptions/route.ts", "utf8");
const pushMigration = readFileSync(
  "supabase/migrations/20260713183514_push_subscription_foundation.sql",
  "utf8",
);
const allClientPwaSource = [suppressor, installButton, registrar].join("\n");

function pngDimensions(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a") {
    return null;
  }

  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  };
}

function hasPngDimensions(path, width, height) {
  const dimensions = pngDimensions(path);

  return dimensions?.width === width && dimensions?.height === height;
}

const checks = [
  {
    label: "public assets do not include default scaffold SVGs",
    ok: [
      "public/file.svg",
      "public/globe.svg",
      "public/next.svg",
      "public/vercel.svg",
      "public/window.svg",
    ].every((path) => !existsSync(path)),
  },
  {
    label: "root layout registers service worker and suppresses automatic install sheet",
    ok:
      layout.includes("<ServiceWorkerRegistrar />") &&
      layout.includes("<PwaInstallSuppressor />"),
  },
  {
    label: "PWA icon and screenshot files match manifest dimensions",
    ok:
      hasPngDimensions("public/icons/icon-192.png", 192, 192) &&
      hasPngDimensions("public/icons/icon-512.png", 512, 512) &&
      hasPngDimensions("public/icons/maskable-512.png", 512, 512) &&
      hasPngDimensions("public/screenshots/mobile-home.png", 540, 960) &&
      hasPngDimensions("public/screenshots/desktop-home.png", 1280, 720) &&
      hasPngDimensions("public/splash/splash-2048.png", 2048, 2048),
  },
  {
    label: "installed app shortcuts include launch columns and alerts",
    ok:
      manifest.includes('"start_url": "/login"') &&
      manifest.includes('"name": "4U"') &&
      manifest.includes('"url": "/#feed"') &&
      manifest.includes('"name": "Gossip"') &&
      manifest.includes('"url": "/#threads"') &&
      manifest.includes('"name": "Stuff"') &&
      manifest.includes('"url": "/#marketplace"') &&
      manifest.includes('"name": "Gigs"') &&
      manifest.includes('"url": "/#gigs"') &&
      manifest.includes('"name": "DM"') &&
      manifest.includes('"url": "/messages"') &&
      manifest.includes('"name": "Alerts"') &&
      manifest.includes('"url": "/notifications"') &&
      manifest.includes('"name": "Merch"') &&
      manifest.includes('"url": "/#merch"') &&
      (manifest.match(/"icons": \[/g) || []).length >= 8,
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
    label: "push display is prepared and browser subscription is key-gated",
    ok:
      serviceWorker.includes('self.addEventListener("push"') &&
      serviceWorker.includes("showNotification") &&
      !allClientPwaSource.includes("Notification.requestPermission") &&
      pushControl.includes("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") &&
      pushControl.includes("Notification.requestPermission") &&
      pushControl.includes(".pushManager.subscribe") &&
      pushControl.includes("/api/push/subscriptions"),
  },
  {
    label: "push subscriptions are stored behind authenticated RLS",
    ok:
      pushMigration.includes("create table if not exists public.push_subscriptions") &&
      pushMigration.includes("alter table public.push_subscriptions enable row level security") &&
      pushMigration.includes('create policy "Users insert own push subscriptions"') &&
      pushMigration.includes('create policy "Users update own push subscriptions"') &&
      pushMigration.includes("profile_id, endpoint") &&
      pushRoute.includes("await supabase.auth.getClaims()") &&
      pushRoute.includes('.from("push_subscriptions").upsert') &&
      pushRoute.includes('onConflict: "profile_id,endpoint"') &&
      pushRoute.includes("export async function DELETE") &&
      pushControl.includes('method: "DELETE"'),
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
