import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const source = {
  actions: read("src/app/account/actions.ts"),
  androidAppBuild: read(
    "native/thetattoocore-mobile/android/app/build.gradle",
  ),
  androidManifest: read(
    "native/thetattoocore-mobile/android/app/src/main/AndroidManifest.xml",
  ),
  androidPluginBuild: read(
    "native/thetattoocore-mobile/android/app/capacitor.build.gradle",
  ),
  androidPluginSettings: read(
    "native/thetattoocore-mobile/android/capacitor.settings.gradle",
  ),
  browserApi: read("src/app/api/push/subscriptions/route.ts"),
  capacitorConfig: read(
    "native/thetattoocore-mobile/capacitor.config.ts",
  ),
  control: read("src/app/push-subscription-control.tsx"),
  customWorker: read("custom-worker.ts"),
  deviceApi: read("src/app/api/push/devices/route.ts"),
  deviceTestApi: read("src/app/api/push/devices/test/route.ts"),
  deliveryMigration: read(
    "supabase/migrations/20260722225151_native_push_delivery_outbox.sql",
  ),
  env: read(".env.example"),
  iosAppDelegate: read(
    "native/thetattoocore-mobile/ios/App/App/AppDelegate.swift",
  ),
  iosEntitlements: read(
    "native/thetattoocore-mobile/ios/App/App/App.entitlements",
  ),
  iosInfo: read("native/thetattoocore-mobile/ios/App/App/Info.plist"),
  iosPodfile: read("native/thetattoocore-mobile/ios/App/Podfile"),
  iosProject: read(
    "native/thetattoocore-mobile/ios/App/App.xcodeproj/project.pbxproj",
  ),
  layout: read("src/app/layout.tsx"),
  qaAccess: read("src/lib/native-push/qa-access.ts"),
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
  rootPackage: read("package.json"),
  routeGuard: read("src/lib/notification-route.ts"),
  sender: read("src/lib/native-push/sender.ts"),
  senderCore: read("src/lib/native-push/sender-core.ts"),
  signout: read("src/app/auth/signout/route.ts"),
  signoutForm: read("src/app/native-aware-signout-form.tsx"),
  wrangler: read("wrangler.jsonc"),
};

const permissionRequestPosition = source.provider.indexOf(
  "runtime.messaging.requestPermissions()",
);
const explicitEnablePosition = source.provider.indexOf(
  "const enable = useCallback",
);
const deliveryTableSql =
  source.deliveryMigration.split("create or replace function")[0] ?? "";

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
        source.nativeProbe.includes("NATIVE_PUSH_QA server_delivery_result=") &&
        source.nativeProbe.includes("NATIVE_PUSH_QA activation_result=") &&
        source.nativeProbe.includes(
          'const expectedIosBundleId = "com.thetattoocore.app"',
        ) &&
        source.nativeProbe.includes(
          'plistString(source.iosConfig, "BUNDLE_ID") === expectedIosBundleId',
        ) &&
        source.nativeProbe.includes("const androidPrivateConfig = jsonObject") &&
        source.nativeProbe.includes(
          'client_info?.android_client_info?.package_name ===',
        ) &&
        source.nativeProbe.includes(
          'androidProjectInfo.project_id === plistString(source.iosConfig, "PROJECT_ID")',
        ) &&
        source.nativeProbe.includes(
          'plistString(source.iosConfig, "GCM_SENDER_ID")',
        ) &&
        source.nativeProbe.includes('"project_consistency"') &&
        source.nativeProbe.includes(
          '["GOOGLE_APP_ID", "GCM_SENDER_ID", "PROJECT_ID"]',
        ) &&
        activationKeys.includes('"android_permission_enabled"') &&
        activationKeys.includes('"ios_push_capability"') &&
        activationKeys.includes('"delivery_runtime_activation"') &&
        activationKeys.includes('"delivery_evidence"') &&
        !activationKeys.includes("activation_lock") &&
        !activationKeys.includes("staging_guard") &&
        !source.nativeProbe.includes("const activationReady = checks.every")
      );
    })(),
  },
  {
    label: "Android service-hook readiness follows guarded private config",
    ok:
      source.androidAppBuild.includes(
        "def ttcServicesFile = file('google-services.json')",
      ) &&
      source.androidAppBuild.includes("if (hasTtcServicesConfig)") &&
      source.nativeProbe.includes(
        "def ttcServicesFile = file('google-services.json')",
      ) &&
      source.nativeProbe.includes("if (hasTtcServicesConfig)"),
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
      source.androidManifest.includes(
        'android:name="android.permission.POST_NOTIFICATIONS"',
      ) &&
      !source.androidManifest.includes('tools:node="remove"') &&
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
    label: "native registrations record the exact installed app build",
    ok:
      source.rootPackage.includes('"@capacitor/app": "7.1.2"') &&
      source.nativePackage.includes('"@capacitor/app": "^7.1.0"') &&
      source.androidPluginSettings.includes("include ':capacitor-app'") &&
      source.androidPluginBuild.includes("implementation project(':capacitor-app')") &&
      source.iosPodfile.includes("pod 'CapacitorApp'") &&
      source.provider.includes('import("@capacitor/app")') &&
      source.provider.includes("App.getInfo()") &&
      source.provider.includes("appBuild: appInfo.build") &&
      source.provider.includes("appVersion: appInfo.version") &&
      /saveDeviceToken\(\s*runtime\.platform,\s*event\.token,\s*runtime\.appInfo,?\s*\)/s.test(
        source.provider,
      ) &&
      source.provider.includes(
        "saveDeviceToken(runtime.platform, token, runtime.appInfo)",
      ) &&
      source.deviceApi.includes(
        "const appBuild = cleanRequiredString(payload?.appBuild, 40)",
      ) &&
      source.deviceApi.includes(
        "const appVersion = cleanRequiredString(payload?.appVersion, 40)",
      ) &&
      source.deviceApi.includes("!appBuild ||") &&
      source.deviceApi.includes("!appVersion ||") &&
      source.deviceApi.includes("app_build: appBuild") &&
      source.deviceApi.includes("app_version: appVersion") &&
      source.migration.includes("app_version text") &&
      source.migration.includes("app_build text") &&
      source.migration.includes("char_length(app_version) between 1 and 40") &&
      source.migration.includes("char_length(app_build) between 1 and 40") &&
      source.nativeProbe.includes('key: "installed_build_registration"') &&
      source.nativeProbe.includes('"installed_build_registration"'),
  },
  {
    label: "controlled native registration QA is role and exact-build scoped",
    ok:
      source.qaAccess.includes('android: { build: "3", version: "1.0.2" }') &&
      source.qaAccess.includes('ios: { build: "4", version: "1.0" }') &&
      source.qaAccess.includes('role === "admin" || role === "owner"') &&
      source.layout.includes("nativePushQaRoleAllowed(role)") &&
      source.layout.includes("!nativeDeliveryEnabled") &&
      source.layout.includes(
        "qaBuildRestricted={nativeNotificationQaBuildRestricted}",
      ) &&
      source.provider.includes("nativePushQaBuildAllowed(") &&
      source.provider.includes("qaBuildRestricted &&") &&
      source.deviceApi.includes("nativePushQaRoleAllowed(profile.role)") &&
      source.deviceApi.includes(
        "nativePushQaBuildAllowed(platform, appVersion, appBuild)",
      ) &&
      source.deviceApi.includes(
        'process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED !== "true"',
      ) &&
      source.wrangler.includes(
        '"TTC_DEVICE_ALERT_SETUP_ENABLED": "true"',
      ) &&
      source.wrangler.includes(
        '"TTC_NATIVE_PUSH_REGISTRATION_ENABLED": "true"',
      ) &&
      source.wrangler.includes(
        '"TTC_NATIVE_PUSH_DELIVERY_ENABLED": "false"',
      ),
  },
  {
    label: "controlled native delivery test is self-only and exact-build scoped",
    ok:
      source.deviceTestApi.includes("supabase.auth.getClaims()") &&
      source.deviceTestApi.includes("nativePushQaRoleAllowed(profile.role)") &&
      source.deviceTestApi.includes("nativePushDeviceCookie") &&
      source.deviceTestApi.includes("parseNativePushCookie") &&
      source.deviceTestApi.includes('.eq("profile_id", profile.id)') &&
      source.deviceTestApi.includes(
        '.eq("installation_id", deviceCookie.installationId)',
      ) &&
      source.deviceTestApi.includes('.eq("is_active", true)') &&
      source.deviceTestApi.includes("nativePushQaBuildAllowed(") &&
      source.deviceTestApi.includes(
        "nativePushSenderReady(nativePushEnvironment)",
      ) &&
      source.deviceTestApi.includes(
        "sendNativePushMessage(nativePushEnvironment",
      ) &&
      source.deviceTestApi.includes('title: "Test app alert"') &&
      source.deviceTestApi.includes('body: "Tap to verify app alerts."') &&
      source.deviceTestApi.includes('url: "/notifications"') &&
      source.deviceTestApi.includes("const testAlertDelayMs = 8_000") &&
      source.deviceTestApi.includes("setTimeout(resolve, testAlertDelayMs)") &&
      source.deviceTestApi.includes('result === "token"') &&
      !source.deviceTestApi.includes("console.") &&
      source.senderCore.includes("nativePushSenderReady") &&
      source.sender.includes("export async function sendNativePushMessage") &&
      source.provider.includes('fetch("/api/push/devices/test"') &&
      source.provider.includes("testAvailable: qaBuildRestricted") &&
      source.control.includes("Send test") &&
      source.control.includes(
        "Test alert scheduled. Press Home or lock this device now.",
      ) &&
      source.control.includes("Test alert sent. Tap the alert to verify."),
  },
  {
    label: "native registration status is account-bound before automatic refresh",
    ok:
      source.provider.includes("deviceRegistrationEnabled") &&
      source.provider.includes("let savedEnabled = false;") &&
      /try \{\s*savedEnabled = await deviceRegistrationEnabled\(runtime\.platform\);\s*\} catch \{\s*if \(!cancelled\) \{\s*enabledRef\.current = false;\s*setEnabled\(false\);\s*\}\s*return;\s*\}/s.test(
        source.provider,
      ) &&
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
      source.deviceApi.includes('priorOwnerError') &&
      source.deviceApi.includes('.neq("profile_id", userId)') &&
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
      source.notificationWriter.includes('"insert_notifications_with_native_delivery"') &&
      source.notificationWriter.includes("TTC_NATIVE_PUSH_DELIVERY_ENABLED") &&
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
    label: "native delivery outbox is atomic, leased, and service-only",
    ok:
      source.deliveryMigration.includes("create table if not exists public.native_push_delivery_jobs") &&
      source.deliveryMigration.includes("unique (notification_id, device_id)") &&
      source.deliveryMigration.includes("references public.notifications(id) on delete cascade") &&
      source.deliveryMigration.includes("references public.native_push_devices(id) on delete cascade") &&
      source.deliveryMigration.includes("enable row level security") &&
      source.deliveryMigration.includes("from public, anon, authenticated") &&
      source.deliveryMigration.includes("to service_role") &&
      source.deliveryMigration.includes("insert_notifications_with_native_delivery") &&
      source.deliveryMigration.includes("insert into public.notifications") &&
      source.deliveryMigration.includes("insert into public.native_push_delivery_jobs") &&
      source.deliveryMigration.includes("inserted.type = 'message'") &&
      source.deliveryMigration.includes("inserted.message_id is not null") &&
      source.deliveryMigration.includes("for update skip locked") &&
      source.deliveryMigration.includes("lease_expires_at") &&
      source.deliveryMigration.includes("lease_token = gen_random_uuid()") &&
      source.deliveryMigration.includes("and lease_token = p_lease_token") &&
      source.deliveryMigration.includes("devices.profile_id = notifications.recipient_id") &&
      source.deliveryMigration.includes("last_error_code = 'account_mismatch'") &&
      source.deliveryMigration.includes("and token_hash = p_device_token_hash") &&
      source.deliveryMigration.includes("attempt_count between 0 and 8") &&
      source.deliveryMigration.includes("revoke execute on function public.claim_native_push_delivery_batch") &&
      source.deliveryMigration.includes("grant execute on function public.claim_native_push_delivery_batch") &&
      source.deliveryMigration.includes("Device tokens remain in native_push_devices and are never copied here"),
  },
  {
    label: "scheduled native sender is gated, private, and retry aware",
    ok:
      source.wrangler.includes('"main": "custom-worker.ts"') &&
      source.wrangler.includes('"crons": ["* * * * *"]') &&
      source.customWorker.includes("fetch: handler.fetch") &&
      source.customWorker.includes("controller.waitUntil(drainNativePushBatch(env))") &&
      source.senderCore.includes("TTC_DEVICE_ALERT_SETUP_ENABLED === \"true\"") &&
      source.senderCore.includes("TTC_NATIVE_PUSH_REGISTRATION_ENABLED === \"true\"") &&
      source.senderCore.includes("TTC_NATIVE_PUSH_DELIVERY_ENABLED === \"true\"") &&
      source.sender.includes('"claim_native_push_delivery_batch"') &&
      source.sender.includes('"complete_native_push_delivery"') &&
      source.sender.includes('"retry_native_push_delivery"') &&
      source.sender.includes('"suppress_native_push_delivery"') &&
      source.sender.includes("notificationPathOrFallback(job.notification_href)") &&
      source.sender.includes("allowsNoisyDeliveryNow") &&
      source.sender.includes('await suppress("invalid_token", true)') &&
      source.sender.includes("p_lease_token: job.lease_token") &&
      source.sender.includes("p_device_token_hash: deactivateDevice") &&
      source.sender.includes("retryDelaySeconds(") &&
      source.sender.includes("job.attempt_count") &&
      source.senderCore.includes('body = "You have a new message."') &&
      source.senderCore.includes('title = "New message"') &&
      !source.sender.includes("console.") &&
      !deliveryTableSql.includes("device_token") &&
      !deliveryTableSql.includes(" token "),
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
      source.env.includes("TTC_NATIVE_PUSH_DELIVERY_ENABLED=false") &&
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
    label: "iOS build 4 has target-scoped push configuration while auto-init stays off",
    ok:
      /<key>aps-environment<\/key>\s*<string>\$\(APS_ENVIRONMENT\)<\/string>/s.test(
        source.iosEntitlements,
      ) &&
      source.iosProject.includes("GoogleService-Info.plist in Resources") &&
      source.iosProject.includes(
        "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;",
      ) &&
      source.iosProject.includes("com.apple.Push = {") &&
      source.iosProject.includes("APS_ENVIRONMENT = development;") &&
      source.iosProject.includes("APS_ENVIRONMENT = production;") &&
      source.iosProject.match(/CURRENT_PROJECT_VERSION = 4;/g)?.length === 2 &&
      /<key>FirebaseMessagingAutoInitEnabled<\/key>\s*<false\/>/s.test(
        source.iosInfo,
      ),
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
