import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const source = {
  actions: read("src/app/account/actions.ts"),
  androidManifest: read(
    "native/thetattoocore-mobile/android/app/src/main/AndroidManifest.xml",
  ),
  browserApi: read("src/app/api/push/subscriptions/route.ts"),
  capacitorConfig: read(
    "native/thetattoocore-mobile/capacitor.config.ts",
  ),
  control: read("src/app/push-subscription-control.tsx"),
  deviceApi: read("src/app/api/push/devices/route.ts"),
  env: read(".env.example"),
  iosAppDelegate: read(
    "native/thetattoocore-mobile/ios/App/App/AppDelegate.swift",
  ),
  iosInfo: read("native/thetattoocore-mobile/ios/App/App/Info.plist"),
  layout: read("src/app/layout.tsx"),
  migration: read(
    "supabase/migrations/20260722114857_native_push_devices.sql",
  ),
  notificationAccessMigration: read(
    "supabase/migrations/20260722132614_notification_writes_service_role_only.sql",
  ),
  notificationAnonAccessMigration: read(
    "supabase/migrations/20260722143153_notification_anon_privilege_cleanup.sql",
  ),
  notificationProducers: [
    read("src/app/actions.ts"),
    read("src/app/account/actions.ts"),
    read("src/app/admin/actions.ts"),
    read("src/app/api/gigs/route.ts"),
    read("src/app/api/stripe/webhook/route.ts"),
    read("src/app/messages/actions.ts"),
    read("src/app/notifications/actions.ts"),
    read("src/app/u/[username]/actions.ts"),
  ],
  notificationWriter: read("src/lib/notification-write.ts"),
  nativePackage: read("native/thetattoocore-mobile/package.json"),
  nativeProbe: read("scripts/native-push-qa-probe.mjs"),
  profileForm: read("src/app/account/profile-form.tsx"),
  provider: read("src/app/native-notification-provider.tsx"),
  routeGuard: read("src/lib/notification-route.ts"),
  signout: read("src/app/auth/signout/route.ts"),
  signoutForm: read("src/app/native-aware-signout-form.tsx"),
};

const permissionRequestPosition = source.provider.indexOf(
  "runtime.messaging.requestPermissions()",
);
const explicitEnablePosition = source.provider.indexOf(
  "const enable = useCallback",
);

const checks = [
  {
    label: "native readiness probe separates staging locks from activation",
    ok: (() => {
      const activationKeys =
        source.nativeProbe.match(/const activationCheckKeys = \[([\s\S]*?)\];/)?.[1] ?? "";

      return (
        source.nativeProbe.includes("const bridgeCheckKeys = [") &&
        source.nativeProbe.includes("const privateConfigCheckKeys = [") &&
        source.nativeProbe.includes("NATIVE_PUSH_QA bridge_result=") &&
        source.nativeProbe.includes("NATIVE_PUSH_QA private_config_result=") &&
        source.nativeProbe.includes("NATIVE_PUSH_QA staging_guard=") &&
        source.nativeProbe.includes("NATIVE_PUSH_QA activation_result=") &&
        activationKeys.includes('"android_permission_enabled"') &&
        activationKeys.includes('"ios_push_capability"') &&
        !activationKeys.includes("activation_lock") &&
        !activationKeys.includes("staging_guard") &&
        !source.nativeProbe.includes("const activationReady = checks.every")
      );
    })(),
  },
  {
    label: "native delivery uses one Capacitor messaging bridge",
    ok:
      source.nativePackage.includes(
        '"@capacitor-firebase/messaging": "7.5.0"',
      ) &&
      source.nativePackage.includes('"firebase": "11.10.0"') &&
      !source.nativePackage.includes("@capacitor/push-notifications"),
  },
  {
    label: "native token generation and presentation stay inert by default",
    ok:
      source.androidManifest.includes(
        'android:name="firebase_messaging_auto_init_enabled"',
      ) &&
      source.androidManifest.includes(
        'android:name="firebase_analytics_collection_enabled"',
      ) &&
      source.androidManifest.includes('tools:node="remove"') &&
      /<key>FirebaseMessagingAutoInitEnabled<\/key>\s*<false\/>/s.test(
        source.iosInfo,
      ) &&
      source.capacitorConfig.includes("presentationOptions: []"),
  },
  {
    label: "notification permission is requested only by explicit enable",
    ok:
      explicitEnablePosition >= 0 &&
      permissionRequestPosition > explicitEnablePosition &&
      source.control.includes("onClick={enabled ? disableAlerts : enableAlerts}"),
  },
  {
    label: "native client registers, refreshes, removes, and never persists raw tokens",
    ok:
      source.provider.includes("/api/push/devices") &&
      source.provider.includes('"tokenReceived"') &&
      source.provider.includes("runtime.messaging.getToken()") &&
      source.provider.includes("runtime.messaging.deleteToken()") &&
      !source.provider.includes("ttc_native_push_token") &&
      !source.provider.includes("console."),
  },
  {
    label: "native registration status is account-bound before automatic refresh",
    ok:
      source.provider.includes("deviceRegistrationEnabled") &&
      source.deviceApi.includes("export async function GET") &&
      source.deviceApi.includes('.eq("profile_id", userId)') &&
      source.deviceApi.includes('.eq("installation_id", installationId)'),
  },
  {
    label: "native registration API is authenticated, gated, hashed, and bounded",
    ok:
      source.deviceApi.includes("supabase.auth.getClaims()") &&
      source.deviceApi.includes(
        'process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED !== "true"',
      ) &&
      source.deviceApi.includes("createAdminClient()") &&
      source.deviceApi.includes("crypto.subtle.digest") &&
      source.deviceApi.includes("maxActiveDevices = 10") &&
      source.deviceApi.includes("nativePushDeviceCookie") &&
      !source.deviceApi.includes("console."),
  },
  {
    label: "native registration storage is server-only with owner RLS defense",
    ok:
      source.migration.includes(
        "alter table public.native_push_devices enable row level security",
      ) &&
      source.migration.includes("to authenticated") &&
      source.migration.includes("(select auth.uid()) = profile_id") &&
      source.migration.includes(
        "revoke all on table public.native_push_devices from anon, authenticated",
      ) &&
      source.migration.includes(
        "grant select, insert, update, delete on table public.native_push_devices to service_role",
      ) &&
      source.migration.includes("unique (platform, installation_id)") &&
      source.migration.includes("unique (token_hash)"),
  },
  {
    label: "browser endpoints have one owner and remain server-only",
    ok:
      source.migration.includes(
        "add constraint push_subscriptions_endpoint_unique unique (endpoint)",
      ) &&
      source.migration.includes(
        "revoke all on table public.push_subscriptions from anon, authenticated",
      ) &&
      source.browserApi.includes('process.env.TTC_WEB_PUSH_REGISTRATION_ENABLED') &&
      source.browserApi.includes('.select("id, profile_id")') &&
      source.browserApi.includes("existingSubscription.profile_id !== userId") &&
      source.browserApi.includes('.eq("id", existingSubscription.id)') &&
      source.browserApi.includes('.eq("profile_id", userId)') &&
      source.browserApi.includes(".insert({") &&
      !source.browserApi.includes(".upsert(") &&
      source.browserApi.includes("webPushSubscriptionCookie"),
  },
  {
    label: "notification creation is restricted to the shared server-only writer",
    ok:
      source.notificationWriter.includes('import "server-only"') &&
      source.notificationWriter.includes("createAdminClient()") &&
      source.notificationWriter.includes('.from("notifications").insert(rows)') &&
      source.notificationProducers.every(
        (producer) =>
          !/\.from\("notifications"\)\s*\.insert\(/s.test(producer),
      ) &&
      source.notificationProducers.every((producer) =>
        producer.includes("insertNotifications"),
      ) &&
      source.notificationAccessMigration.includes(
        'drop policy if exists "Users can create actor notifications"',
      ) &&
      source.notificationAccessMigration.includes(
        "revoke all privileges on table public.notifications from authenticated",
      ) &&
      source.notificationAccessMigration.includes(
        "grant select, update, delete on table public.notifications to authenticated",
      ) &&
      source.notificationAccessMigration.includes(
        "grant select, insert, update, delete on table public.notifications to service_role",
      ) &&
      source.notificationAnonAccessMigration.includes(
        "revoke all privileges on table public.notifications from anon",
      ) &&
      source.notificationAnonAccessMigration.includes(
        "grant select, insert, update, delete on table public.notifications to service_role",
      ),
  },
  {
    label: "per-device opt-out does not overwrite the account alert master switch",
    ok:
      source.deviceApi.includes("notify_push_enabled: true") &&
      source.browserApi.includes("notify_push_enabled: enabled") &&
      source.browserApi.includes("export async function DELETE") &&
      !source.actions.includes('formData.get("notify_push_enabled")') &&
      !source.profileForm.includes('name="notify_push_enabled"'),
  },
  {
    label: "sign-out removes current native and browser registrations",
    ok:
      source.signout.includes('from("native_push_devices")') &&
      source.signout.includes('from("push_subscriptions")') &&
      source.signout.includes("nativePushDeviceCookie") &&
      source.signout.includes("webPushSubscriptionCookie") &&
      source.signout.includes("const removalResults = await Promise.all(removals)") &&
      source.signout.includes("removalResults.some((result) => result.error)") &&
      source.signout.includes("if (!admin)") &&
      source.signout.includes("Sign-out%20could%20not%20be%20completed") &&
      source.signout.indexOf("Promise.all(removals)") <
        source.signout.indexOf("supabase.auth.signOut()") &&
      source.signout.indexOf("removalResults.some((result) => result.error)") <
        source.signout.indexOf("supabase.auth.signOut()") &&
      source.signoutForm.includes("nativeNotifications.disable()") &&
      source.signoutForm.indexOf("nativeNotifications.disable()") <
        source.signoutForm.indexOf("form.submit()"),
  },
  {
    label: "native alert setup and both registration paths fail closed",
    ok:
      source.env.includes("TTC_DEVICE_ALERT_SETUP_ENABLED=false") &&
      source.env.includes("TTC_NATIVE_PUSH_REGISTRATION_ENABLED=false") &&
      source.env.includes("TTC_WEB_PUSH_REGISTRATION_ENABLED=false") &&
      source.layout.includes(
        'process.env.TTC_DEVICE_ALERT_SETUP_ENABLED === "true"',
      ) &&
      source.layout.includes("<NativeNotificationProvider"),
  },
  {
    label: "native notification taps use the shared same-origin route allowlist",
    ok:
      source.provider.includes("notificationPathOrFallback") &&
      source.provider.includes('"notificationActionPerformed"') &&
      source.routeGuard.includes('href.startsWith("//")') &&
      source.routeGuard.includes('href.includes("\\\\")') &&
      source.routeGuard.includes('return safeNotificationPath(value) ?? "/notifications"'),
  },
  {
    label: "iOS notification registration callbacks are staged",
    ok:
      source.iosAppDelegate.includes(
        "didRegisterForRemoteNotificationsWithDeviceToken",
      ) &&
      source.iosAppDelegate.includes(
        "didFailToRegisterForRemoteNotificationsWithError",
      ) &&
      source.iosAppDelegate.includes("didReceiveRemoteNotification"),
  },
  {
    label: "member controls use neutral app-alert wording",
    ok:
      source.control.includes("App alerts") &&
      source.control.includes("Device alerts are off.") &&
      !source.control.includes("Firebase") &&
      !source.control.includes("Supabase") &&
      !source.control.includes("FCM"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length > 0) {
  console.error(`${failures.length} native push guard check(s) failed.`);
  process.exit(1);
}
