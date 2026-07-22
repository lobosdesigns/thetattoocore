import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
const manifestJson = JSON.parse(manifest);
const suppressor = readFileSync("src/app/pwa-install-suppressor.tsx", "utf8");
const installButton = readFileSync("src/app/pwa-install-button.tsx", "utf8");
const registrar = readFileSync("src/app/service-worker-registrar.tsx", "utf8");
const notificationPrefs = readFileSync("src/lib/notifications.ts", "utf8");
const serviceWorker = readFileSync("public/sw.js", "utf8");
const pushControl = readFileSync("src/app/push-subscription-control.tsx", "utf8");
const accountProfileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const notificationsPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const notificationRoute = readFileSync("src/lib/notification-route.ts", "utf8");
const mobileSmoke = readFileSync("scripts/smoke-mobile-browser.mjs", "utf8");
const pushRoute = readFileSync("src/app/api/push/subscriptions/route.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const pushMigration = readFileSync(
  "supabase/migrations/20260713183514_push_subscription_foundation.sql",
  "utf8",
);
const pushHardeningMigration = readFileSync(
  "supabase/migrations/20260722114857_native_push_devices.sql",
  "utf8",
);
const allClientPwaSource = [suppressor, installButton, registrar].join("\n");
const userFacingPushSource = [accountProfileForm, notificationsPage, pushControl].join("\n");
const manifestMemberFacingText = [
  manifestJson.name,
  manifestJson.short_name,
  manifestJson.description,
  ...(manifestJson.categories ?? []),
  ...(manifestJson.screenshots ?? []).flatMap((screenshot) => [screenshot.label, screenshot.src]),
  ...(manifestJson.shortcuts ?? []).flatMap((shortcut) => [
    shortcut.name,
    shortcut.description,
    shortcut.url,
  ]),
]
  .filter(Boolean)
  .join("\n")
  .toLowerCase();
const mobileSmokeRoutePaths = new Set(
  [...mobileSmoke.matchAll(/path: "([^"]+)"/g)].map((match) => match[1]),
);
const manifestShortcutUrls = (manifestJson.shortcuts ?? []).map((shortcut) => shortcut.url);
const missingMobileShortcutRoutes = manifestShortcutUrls.filter(
  (url) => !mobileSmokeRoutePaths.has(url),
);
const manifestShortcutIconSources = [
  ...new Set(
    (manifestJson.shortcuts ?? []).flatMap((shortcut) =>
      (shortcut.icons ?? []).map((icon) => icon.src),
    ),
  ),
];
const manifestBlockedTerms = [
  "api key",
  "cloudflare",
  "database",
  "hostgator",
  "instant payout",
  "live payment",
  "payment provider",
  "public launch",
  "real-money checkout",
  "sandbox",
  "stripe",
  "supabase",
  "unrestricted marketplace",
];
const expectedNotificationFallbacks = [
  'return `/p/${notification.subject_id}`',
  'return `/t/${notification.subject_id}`',
  'return notificationHrefOrFallback(notification, "/#stories")',
  '`/messages?c=${notification.subject_id}`',
  '`/u/${notification.profiles.username}`',
  '`/merch/${notification.subject_id}`',
  'return notificationHrefOrFallback(notification, "/account#order-settings")',
  '"/account#advertising-settings"',
  'return notificationHrefOrFallback(notification, "/account#booking-settings")',
  '"/account#verification-settings"',
  'return notificationHrefOrFallback(notification, "/notifications")',
];
const expectedNotificationAllowedPaths = [
  '"/"',
  '"/account"',
  '"/messages"',
  '"/notifications"',
  '"/saved"',
  '"/search"',
];
const expectedNotificationAllowedPrefixes = [
  '"/p/"',
  '"/t/"',
  '"/u/"',
  '"/merch/"',
  '"/stuff/"',
  '"/gigs/"',
];
const expectedNotificationFallbackRoutePairs = [
  ['`/p/${notification.subject_id}`', '"/p/"'],
  ['`/t/${notification.subject_id}`', '"/t/"'],
  ['"/#stories"', '"/"'],
  ['`/messages?c=${notification.subject_id}`', '"/messages"'],
  ['`/u/${notification.profiles.username}`', '"/u/"'],
  ['`/merch/${notification.subject_id}`', '"/merch/"'],
  ['"/account#order-settings"', '"/account"'],
  ['"/account#advertising-settings"', '"/account"'],
  ['"/account#booking-settings"', '"/account"'],
  ['"/account#verification-settings"', '"/account"'],
  ['"/notifications"', '"/notifications"'],
];
const notificationHrefBody =
  notificationsPage.match(/function notificationHref\(notification: Notification\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const forbiddenNotificationHrefDestinations = [
  '"/admin',
  '"/api',
  '"http:',
  '"https:',
  '"//',
  '"javascript:',
];

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

function describePngDimensionIssue(path, width, height) {
  if (!existsSync(path)) {
    return `${path} is missing`;
  }

  const dimensions = pngDimensions(path);

  if (!dimensions) {
    return `${path} is not a readable PNG`;
  }

  if (dimensions.width !== width || dimensions.height !== height) {
    return `${path} is ${dimensions.width}x${dimensions.height}; expected ${width}x${height}`;
  }

  return "";
}

function describeManifestScreenshotDimensionIssues() {
  return (manifestJson.screenshots ?? [])
    .map((screenshot) => {
      const [width, height] = screenshot.sizes
        .split("x")
        .map((size) => Number.parseInt(size, 10));

      if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return `${screenshot.src} has invalid sizes value: ${screenshot.sizes}`;
      }

      return describePngDimensionIssue(`public${screenshot.src}`, width, height);
    })
    .filter(Boolean);
}

function describePwaAssetDimensionIssues() {
  return [
    describePngDimensionIssue("public/icons/icon-192.png", 192, 192),
    describePngDimensionIssue("public/icons/icon-512.png", 512, 512),
    describePngDimensionIssue("public/icons/maskable-512.png", 512, 512),
    ...describeManifestScreenshotDimensionIssues(),
    describePngDimensionIssue("public/splash/splash-2048.png", 2048, 2048),
  ]
    .filter(Boolean)
    .join("; ");
}

function describeShortcutIconIssues() {
  return manifestShortcutIconSources
    .map((src) => describePngDimensionIssue(`public${src}`, 192, 192))
    .filter(Boolean);
}

const manifestScreenshotsMatchDimensions = (manifestJson.screenshots ?? []).every((screenshot) => {
  const [width, height] = screenshot.sizes.split("x").map((size) => Number.parseInt(size, 10));
  const path = `public${screenshot.src}`;

  return Number.isInteger(width) && Number.isInteger(height) && hasPngDimensions(path, width, height);
});
const shortcutIconIssues = describeShortcutIconIssues();

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
    message: describePwaAssetDimensionIssues(),
    ok:
      hasPngDimensions("public/icons/icon-192.png", 192, 192) &&
      hasPngDimensions("public/icons/icon-512.png", 512, 512) &&
      hasPngDimensions("public/icons/maskable-512.png", 512, 512) &&
      manifestScreenshotsMatchDimensions &&
      hasPngDimensions("public/splash/splash-2048.png", 2048, 2048),
  },
  {
    label: "installed app shortcuts include launch columns and alerts",
    ok:
      manifest.includes('"start_url": "/login"') &&
      manifest.includes('"name": "4U"') &&
      manifest.includes('"url": "/#feed"') &&
      mobileSmoke.includes('path: "/#feed"') &&
      manifest.includes('"name": "Gossip"') &&
      manifest.includes('"url": "/#threads"') &&
      mobileSmoke.includes('path: "/#threads"') &&
      manifest.includes('"name": "Stuff"') &&
      manifest.includes('"url": "/#marketplace"') &&
      mobileSmoke.includes('path: "/#marketplace"') &&
      manifest.includes('"name": "Gigs"') &&
      manifest.includes('"url": "/#gigs"') &&
      mobileSmoke.includes('path: "/#gigs"') &&
      manifest.includes('"name": "DM"') &&
      manifest.includes('"url": "/messages"') &&
      mobileSmoke.includes('path: "/messages"') &&
      manifest.includes('"name": "Alerts"') &&
      manifest.includes('"url": "/notifications"') &&
      manifest.includes('"name": "Merch"') &&
      manifest.includes('"url": "/#merch"') &&
      mobileSmoke.includes('path: "/#merch"') &&
      (manifest.match(/"icons": \[/g) || []).length >= 8,
  },
  {
    label: "installed app shortcut routes have direct mobile smoke coverage",
    message: missingMobileShortcutRoutes.length
      ? `missing mobile shortcut routes: ${missingMobileShortcutRoutes.join(", ")}`
      : "",
    ok: missingMobileShortcutRoutes.length === 0,
  },
  {
    label: "installed app shortcut icons are upload-safe PNGs",
    message: shortcutIconIssues.length ? shortcutIconIssues.join("; ") : "",
    ok: manifestShortcutIconSources.length > 0 && shortcutIconIssues.length === 0,
  },
  {
    label: "installed app manifest copy avoids provider details and launch over-promises",
    ok:
      manifestJson.id === "https://thetattoocore.com" &&
      manifestJson.name === "TheTattooCore" &&
      manifestJson.short_name === "TTC" &&
      manifestJson.start_url === "/login" &&
      manifestJson.description.includes("no AI art or scratcher promotion") &&
      manifestBlockedTerms.every((term) => !manifestMemberFacingText.includes(term)),
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
    label: "service worker keeps a conservative offline app shell fallback",
    ok:
      serviceWorker.includes('const STATIC_CACHE_NAME = "ttc-static-v1"') &&
      serviceWorker.includes('const OFFLINE_URL = "/offline.html"') &&
      serviceWorker.includes("cache.addAll(STATIC_CACHE_URLS)") &&
      serviceWorker.includes("key.startsWith(\"ttc-static-\")") &&
      serviceWorker.includes('event.request.mode === "navigate"') &&
      serviceWorker.includes("networkFirstNavigation(event.request)") &&
      serviceWorker.includes("caches.match(OFFLINE_URL)") &&
      serviceWorker.includes("isStaticShellAsset(url.pathname)") &&
      serviceWorker.includes('pathname.startsWith("/_next/static/")') &&
      serviceWorker.includes('pathname.startsWith("/icons/")') &&
      serviceWorker.includes('pathname.startsWith("/splash/")') &&
      serviceWorker.includes("cache.put(request, response.clone())") &&
      serviceWorker.includes("TheTattooCore is offline. Reconnect and try again.") &&
      !serviceWorker.includes('pathname.startsWith("/api/")') &&
      !serviceWorker.includes('pathname.startsWith("/admin/")'),
  },
  {
    label: "push display is prepared and browser subscription is key-gated",
    ok:
      serviceWorker.includes('self.addEventListener("push"') &&
      serviceWorker.includes("showNotification") &&
      !allClientPwaSource.includes("Notification.requestPermission") &&
      pushControl.includes("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") &&
      pushControl.includes("NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED") &&
      pushControl.includes('process.env.NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED === "true"') &&
      pushControl.includes("deviceAlertSetupEnabled && Boolean(publicPushKey)") &&
      pushControl.includes("Notification.requestPermission") &&
      pushControl.includes(".pushManager.subscribe") &&
      pushControl.includes("/api/push/subscriptions") &&
      envExample.includes("NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED=false"),
  },
  {
    label: "user-facing push copy avoids technical install-channel wording",
    ok:
      userFacingPushSource.includes("App alerts") &&
      userFacingPushSource.includes("Phone app alerts are off") &&
      userFacingPushSource.includes("Alert settings") &&
      userFacingPushSource.includes(
        "Follow requests, DMs, booking updates, order updates",
      ) &&
      userFacingPushSource.includes("verification, and safety notices") &&
      userFacingPushSource.includes("For now, this page is") &&
      userFacingPushSource.includes("your reliable alert inbox") &&
      userFacingPushSource.includes("Keep checking this inbox until device alerts are ready on your") &&
      userFacingPushSource.includes("Alert help") &&
      userFacingPushSource.includes("Device alerts are being prepared. Keep checking Notifications for now.") &&
      userFacingPushSource.includes("Device alert preference saved. Keep checking Notifications for now.") &&
      pushControl.includes("Notification.permission === \"denied\"") &&
      userFacingPushSource.includes("Device alerts are blocked in this browser. Keep checking Notifications for now.") &&
      pushControl.includes("supported && !permissionBlocked") &&
      userFacingPushSource.includes("Turn on alerts for activity you care about.") &&
      userFacingPushSource.includes("Device alerts are off.") &&
      userFacingPushSource.includes("Device alerts are blocked in system settings.") &&
      userFacingPushSource.includes("App alert setup could not be completed.") &&
      !userFacingPushSource.includes("Enabled on this device.") &&
      !userFacingPushSource.includes("Ready when you turn it on.") &&
      !userFacingPushSource.includes("Prepare push notifications") &&
      !userFacingPushSource.includes("Push alerts stay off") &&
      !userFacingPushSource.includes("Push setup could not be completed.") &&
      !userFacingPushSource.includes("Push permission was not enabled.") &&
      !userFacingPushSource.includes("Push could not be turned off.") &&
      !userFacingPushSource.includes('"PWA"') &&
      !userFacingPushSource.includes("Browser push") &&
      !userFacingPushSource.includes("installed app push") &&
      !userFacingPushSource.includes("iOS or Android push") &&
      !userFacingPushSource.includes("installed-web-app") &&
      !userFacingPushSource.includes("Native iOS") &&
      !userFacingPushSource.includes("Push roadmap"),
  },
  {
    label: "mobile smoke keeps Alerts fallback route covered before native push",
    ok:
      mobileSmoke.includes('path: "/notifications"') &&
      mobileSmoke.includes('textIncludes: "Sign in"') &&
      mobileSmoke.includes('titleIncludes: "Sign in"') &&
      userFacingPushSource.includes("Keep checking Notifications for now."),
  },
  {
    label: "push subscriptions are authenticated and server-only",
    ok:
      pushMigration.includes("create table if not exists public.push_subscriptions") &&
      pushMigration.includes("alter table public.push_subscriptions enable row level security") &&
      pushMigration.includes('create policy "Users insert own push subscriptions"') &&
      pushMigration.includes('create policy "Users update own push subscriptions"') &&
      pushHardeningMigration.includes(
        "add constraint push_subscriptions_endpoint_unique unique (endpoint)",
      ) &&
      pushHardeningMigration.includes(
        "revoke all on table public.push_subscriptions from anon, authenticated",
      ) &&
      pushHardeningMigration.includes(
        "grant select, insert, update, delete on table public.push_subscriptions to service_role",
      ) &&
      pushRoute.includes("supabase.auth.getClaims()") &&
      pushRoute.includes("createAdminClient()") &&
      pushRoute.includes('.from("push_subscriptions")') &&
      pushRoute.includes('.select("id, profile_id")') &&
      pushRoute.includes("existingSubscription.profile_id !== userId") &&
      pushRoute.includes(".update(registration)") &&
      pushRoute.includes(".insert({") &&
      pushRoute.includes('.eq("profile_id", userId)') &&
      !pushRoute.includes(".upsert(") &&
      pushRoute.includes("export async function GET") &&
      pushRoute.includes("export async function DELETE") &&
      pushRoute.includes("async function updatePushPreference") &&
      pushRoute.includes("notify_push_enabled: enabled") &&
      pushRoute.includes("enabled: true") &&
      !pushRoute.includes("hasActiveSubscriptions") &&
      pushControl.includes('method: "DELETE"') &&
      pushControl.includes("const response = await fetch(\"/api/push/subscriptions\"") &&
      pushControl.includes("if (!response.ok) throw new Error(\"App alert preference could not be saved.\")") &&
      pushControl.indexOf("if (!response.ok)") < pushControl.indexOf("await subscription.unsubscribe()"),
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
    label: "notification clicks navigate before focusing existing app windows",
    ok:
      serviceWorker.includes(".navigate(url)") &&
      serviceWorker.includes(".then((navigatedClient) => (navigatedClient || client).focus())") &&
      serviceWorker.includes(".catch(() => client.focus())") &&
      serviceWorker.includes("return self.clients.openWindow(url)"),
  },
  {
    label: "notification click routes are limited to user-facing paths",
    ok:
      serviceWorker.includes("allowedNotificationPath") &&
      serviceWorker.includes("allowedPaths") &&
      serviceWorker.includes("allowedPrefixes") &&
      expectedNotificationAllowedPaths.every((path) => serviceWorker.includes(path)) &&
      expectedNotificationAllowedPrefixes.every((prefix) => serviceWorker.includes(prefix)),
  },
  {
    label: "service worker allows notification page fallback destinations",
    ok:
      notificationRoute.includes("function safeNotificationPath") &&
      notificationsPage.includes("function notificationHrefOrFallback") &&
      notificationRoute.includes("return `${url.pathname}${url.search}${url.hash}`") &&
      expectedNotificationFallbacks.every((snippet) => notificationsPage.includes(snippet)) &&
      expectedNotificationFallbackRoutePairs.every(
        ([fallbackRoute, allowedRoute]) =>
          notificationHrefBody.includes(fallbackRoute) && serviceWorker.includes(allowedRoute),
      ) &&
      forbiddenNotificationHrefDestinations.every(
        (destination) => !notificationHrefBody.includes(destination),
      ),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  for (const check of failures) {
    if (check.message) {
      console.error(`  ${check.message}`);
    }
  }
  console.error(`${failures.length} PWA guard smoke check(s) failed.`);
  process.exit(1);
}
