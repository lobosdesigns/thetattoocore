import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requireReady = process.argv.includes("--require-ready");
const wrapperRoot = "native/thetattoocore-mobile";

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function plistString(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (
    source.match(
      new RegExp(
        `<key>\\s*${escapedKey}\\s*</key>\\s*<string>\\s*([^<]+?)\\s*</string>`,
        "s",
      ),
    )?.[1]?.trim() ?? ""
  );
}

function jsonObject(source) {
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const files = {
  androidAppBuild: `${wrapperRoot}/android/app/build.gradle`,
  androidConfig: `${wrapperRoot}/android/app/google-services.json`,
  androidManifest: `${wrapperRoot}/android/app/src/main/AndroidManifest.xml`,
  androidPluginBuild: `${wrapperRoot}/android/app/capacitor.build.gradle`,
  androidPluginSettings: `${wrapperRoot}/android/capacitor.settings.gradle`,
  iosAppDelegate: `${wrapperRoot}/ios/App/App/AppDelegate.swift`,
  iosConfig: `${wrapperRoot}/ios/App/App/GoogleService-Info.plist`,
  iosEntitlements: `${wrapperRoot}/ios/App/App/App.entitlements`,
  iosInfo: `${wrapperRoot}/ios/App/App/Info.plist`,
  iosProject: `${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`,
  iosPodfile: `${wrapperRoot}/ios/App/Podfile`,
  layout: "src/app/layout.tsx",
  nativeDevicesMigration: "supabase/migrations/20260722114857_native_push_devices.sql",
  nativeDeliveryMigration:
    "supabase/migrations/20260722225151_native_push_delivery_outbox.sql",
  nativeDeliverySender: "src/lib/native-push/sender.ts",
  nativeDeliverySenderCore: "src/lib/native-push/sender-core.ts",
  notificationWriter: "src/lib/notification-write.ts",
  packageJson: `${wrapperRoot}/package.json`,
  provider: "src/app/native-notification-provider.tsx",
  qaAccess: "src/lib/native-push/qa-access.ts",
  rootPackageJson: "package.json",
  deviceApi: "src/app/api/push/devices/route.ts",
  worker: "custom-worker.ts",
  wrangler: "wrangler.jsonc",
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, read(path)]),
);
const expectedIosBundleId = "com.thetattoocore.app";
const expectedAndroidPackage = "com.thetattoocore.app";
const androidPrivateConfig = jsonObject(source.androidConfig);
const androidProjectInfo = androidPrivateConfig.project_info ?? {};
const androidClient = (androidPrivateConfig.client ?? []).find(
  (client) =>
    client?.client_info?.android_client_info?.package_name ===
    expectedAndroidPackage,
);
const androidPrivateConfigReady =
  existsSync(files.androidConfig) &&
  Boolean(androidProjectInfo.project_id) &&
  Boolean(androidProjectInfo.project_number) &&
  Boolean(androidClient?.client_info?.mobilesdk_app_id);
const iosPrivateConfigReady =
  existsSync(files.iosConfig) &&
  plistString(source.iosConfig, "BUNDLE_ID") === expectedIosBundleId &&
  ["GOOGLE_APP_ID", "GCM_SENDER_ID", "PROJECT_ID"].every((key) =>
    Boolean(plistString(source.iosConfig, key)),
  );
const projectConsistencyReady =
  androidPrivateConfigReady &&
  iosPrivateConfigReady &&
  androidProjectInfo.project_id === plistString(source.iosConfig, "PROJECT_ID") &&
  String(androidProjectInfo.project_number) ===
    plistString(source.iosConfig, "GCM_SENDER_ID");

function filesUnder(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const clientSource = filesUnder("src")
  .filter((path) => /\.(?:js|jsx|ts|tsx)$/.test(path))
  .map((path) => read(path))
  .join("\n");
const iosConfigFileRefId =
  source.iosProject.match(
    /([A-F0-9]{24}) \/\* GoogleService-Info\.plist \*\/ = \{isa = PBXFileReference;/,
  )?.[1] ?? "";
const iosConfigBuildFileId =
  source.iosProject.match(
    new RegExp(
      `([A-F0-9]{24}) /\\* GoogleService-Info\\.plist in Resources \\*/ = \\{isa = PBXBuildFile; fileRef = ${iosConfigFileRefId}`,
    ),
  )?.[1] ?? "";
const iosResourcesBlock =
  source.iosProject.match(
    /\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//,
  )?.[1] ?? "";
const iosConfigTargeted =
  Boolean(iosConfigFileRefId) &&
  Boolean(iosConfigBuildFileId) &&
  iosResourcesBlock.includes(
    `${iosConfigBuildFileId} /* GoogleService-Info.plist in Resources */`,
  );
const androidActivationLocked =
  /<meta-data\s+android:name="firebase_messaging_auto_init_enabled"\s+android:value="false"\s*\/>/s.test(
    source.androidManifest,
  ) &&
  /<meta-data\s+android:name="firebase_analytics_collection_enabled"\s+android:value="false"\s*\/>/s.test(
    source.androidManifest,
  ) &&
  source.androidManifest.includes('android:name="android.permission.POST_NOTIFICATIONS"') &&
  !source.androidManifest.includes('tools:node="remove"');
const iosActivationLocked =
  /<key>FirebaseMessagingAutoInitEnabled<\/key>\s*<false\/>/s.test(
    source.iosInfo,
  );

const checks = [
  {
    key: "cross_platform_bridge_dependency",
    ready:
      source.packageJson.includes('"@capacitor-firebase/messaging": "7.5.0"') &&
      source.packageJson.includes('"firebase": "11.10.0"') &&
      !source.packageJson.includes('"@capacitor/push-notifications"') &&
      source.androidPluginSettings.includes("include ':capacitor-firebase-messaging'") &&
      source.androidPluginBuild.includes("implementation project(':capacitor-firebase-messaging')") &&
      source.iosPodfile.includes("CapacitorFirebaseMessaging"),
  },
  {
    key: "android_private_config",
    ready: androidPrivateConfigReady,
  },
  {
    key: "project_consistency",
    ready: projectConsistencyReady,
  },
  {
    key: "android_services_hook",
    ready:
      source.androidAppBuild.includes("def ttcServicesFile = file('google-services.json')") &&
      source.androidAppBuild.includes("if (hasTtcServicesConfig)") &&
      source.androidAppBuild.includes("apply plugin: 'com.google.gms.google-services'"),
  },
  {
    key: "android_permission_enabled",
    ready:
      source.androidManifest.includes('android:name="android.permission.POST_NOTIFICATIONS"') &&
      !source.androidManifest.includes('tools:node="remove"'),
  },
  {
    key: "ios_private_config",
    ready: iosPrivateConfigReady,
  },
  {
    key: "ios_config_target",
    ready: iosConfigTargeted,
  },
  {
    key: "ios_push_capability",
    ready:
      /<key>aps-environment<\/key>\s*<string>\$\(APS_ENVIRONMENT\)<\/string>/s.test(
        source.iosEntitlements,
      ) &&
      source.iosProject.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;") &&
      source.iosProject.includes("com.apple.Push = {") &&
      source.iosProject.includes("APS_ENVIRONMENT = development;") &&
      source.iosProject.includes("APS_ENVIRONMENT = production;"),
  },
  {
    key: "ios_registration_bridge",
    ready:
      source.iosAppDelegate.includes("capacitorDidRegisterForRemoteNotifications") &&
      source.iosAppDelegate.includes("capacitorDidFailToRegisterForRemoteNotifications"),
  },
  {
    key: "ios_fcm_token_bridge",
    ready:
      source.packageJson.includes('"@capacitor-firebase/messaging": "7.5.0"') &&
      source.iosPodfile.includes("CapacitorFirebaseMessaging"),
  },
  {
    key: "client_registration_flow",
    ready:
      clientSource.includes("@capacitor-firebase/messaging") &&
      clientSource.includes("runtime.messaging.checkPermissions") &&
      clientSource.includes("runtime.messaging.requestPermissions") &&
      clientSource.includes("runtime.messaging.getToken") &&
      clientSource.includes("runtime.messaging.deleteToken") &&
      clientSource.includes('"notificationActionPerformed"') &&
      clientSource.includes("/api/push/devices") &&
      clientSource.includes("notificationPathOrFallback"),
  },
  {
    key: "server_registration_flow",
    ready:
      clientSource.includes("TTC_NATIVE_PUSH_REGISTRATION_ENABLED") &&
      clientSource.includes('from("native_push_devices")') &&
      clientSource.includes("crypto.subtle.digest") &&
      clientSource.includes("nativePushDeviceCookie"),
  },
  {
    key: "controlled_registration_qa",
    ready:
      source.qaAccess.includes('android: { build: "4", version: "1.0.3" }') &&
      source.qaAccess.includes('ios: { build: "4", version: "1.0" }') &&
      source.qaAccess.includes('role === "admin" || role === "owner"') &&
      source.layout.includes("nativePushQaRoleAllowed(role)") &&
      source.layout.includes(
        "qaBuildRestricted={nativeNotificationQaBuildRestricted}",
      ) &&
      source.provider.includes("nativePushQaBuildAllowed(") &&
      source.deviceApi.includes("nativePushQaRoleAllowed(profile.role)") &&
      source.deviceApi.includes(
        "nativePushQaBuildAllowed(platform, appVersion, appBuild)",
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
    key: "server_delivery_queue",
    ready:
      source.nativeDeliveryMigration.includes("native_push_delivery_jobs") &&
      source.nativeDeliveryMigration.includes("insert_notifications_with_native_delivery") &&
      source.nativeDeliveryMigration.includes("for update skip locked") &&
      source.nativeDeliveryMigration.includes("revoke execute on function") &&
      source.notificationWriter.includes("insert_notifications_with_native_delivery"),
  },
  {
    key: "server_delivery_sender",
    ready:
      source.nativeDeliverySender.includes("drainNativePushBatch") &&
      source.nativeDeliverySender.includes("notificationPathOrFallback") &&
      source.nativeDeliverySender.includes("allowsNoisyDeliveryNow") &&
      source.nativeDeliverySender.includes("suppress_native_push_delivery") &&
      source.nativeDeliverySenderCore.includes("classifyFcmResponse") &&
      source.nativeDeliverySenderCore.includes('title = "New message"') &&
      source.nativeDeliverySenderCore.includes(
        'body = "You have a new message."',
      ),
  },
  {
    key: "server_delivery_schedule",
    ready:
      source.worker.includes("fetch: handler.fetch") &&
      source.worker.includes("drainNativePushBatch(env)") &&
      source.wrangler.includes('"main": "custom-worker.ts"') &&
      source.wrangler.includes('"crons": ["* * * * *"]'),
  },
  {
    key: "delivery_runtime_activation",
    ready:
      process.env.TTC_DEVICE_ALERT_SETUP_ENABLED === "true" &&
      process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED === "true" &&
      process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED === "true" &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      Boolean(process.env.FIREBASE_PROJECT_ID) &&
      Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
      Boolean(process.env.FIREBASE_PRIVATE_KEY),
  },
  {
    key: "delivery_evidence",
    ready: process.env.NATIVE_PUSH_QA_DELIVERY_EVIDENCE === "passed",
  },
  {
    key: "installed_build_registration",
    ready:
      source.rootPackageJson.includes('"@capacitor/app": "7.1.2"') &&
      source.packageJson.includes('"@capacitor/app": "^7.1.0"') &&
      source.androidPluginSettings.includes("include ':capacitor-app'") &&
      source.androidPluginBuild.includes("implementation project(':capacitor-app')") &&
      source.iosPodfile.includes("pod 'CapacitorApp'") &&
      clientSource.includes('import("@capacitor/app")') &&
      clientSource.includes("App.getInfo()") &&
      clientSource.includes("appBuild: appInfo.build") &&
      clientSource.includes("appVersion: appInfo.version") &&
      clientSource.includes("const appBuild = cleanRequiredString(payload?.appBuild, 40)") &&
      clientSource.includes("const appVersion = cleanRequiredString(payload?.appVersion, 40)") &&
      clientSource.includes("!appBuild ||") &&
      clientSource.includes("!appVersion ||") &&
      clientSource.includes("app_build: appBuild") &&
      clientSource.includes("app_version: appVersion") &&
      source.nativeDevicesMigration.includes("app_version text") &&
      source.nativeDevicesMigration.includes("app_build text") &&
      source.nativeDevicesMigration.includes("char_length(app_version) between 1 and 40") &&
      source.nativeDevicesMigration.includes("char_length(app_build) between 1 and 40"),
  },
];

for (const check of checks) {
  console.log(`NATIVE_PUSH_QA ${check.key}=${check.ready ? "ready" : "pending"}`);
}

const checkByKey = new Map(checks.map((check) => [check.key, check.ready]));
const bridgeCheckKeys = [
  "cross_platform_bridge_dependency",
  "android_services_hook",
  "ios_registration_bridge",
  "ios_fcm_token_bridge",
  "client_registration_flow",
  "server_registration_flow",
  "controlled_registration_qa",
  "installed_build_registration",
];
const privateConfigCheckKeys = [
  "android_private_config",
  "project_consistency",
  "ios_private_config",
  "ios_config_target",
];
const serverDeliveryCheckKeys = [
  "server_delivery_queue",
  "server_delivery_sender",
  "server_delivery_schedule",
];
const activationCheckKeys = [
  ...bridgeCheckKeys,
  ...privateConfigCheckKeys,
  ...serverDeliveryCheckKeys,
  "android_permission_enabled",
  "delivery_evidence",
  "delivery_runtime_activation",
  "ios_push_capability",
];
const checksReady = (keys) => keys.every((key) => checkByKey.get(key) === true);
const bridgeReady = checksReady(bridgeCheckKeys);
const privateConfigReady = checksReady(privateConfigCheckKeys);
const serverDeliveryReady = checksReady(serverDeliveryCheckKeys);
const stagingGuardReady = androidActivationLocked && iosActivationLocked;
const activationReady = checksReady(activationCheckKeys);

console.log(`NATIVE_PUSH_QA bridge_result=${bridgeReady ? "ready" : "pending"}`);
console.log(
  `NATIVE_PUSH_QA private_config_result=${privateConfigReady ? "ready" : "pending"}`,
);
console.log(
  `NATIVE_PUSH_QA server_delivery_result=${serverDeliveryReady ? "ready" : "pending"}`,
);
console.log(`NATIVE_PUSH_QA staging_guard=${stagingGuardReady ? "ready" : "pending"}`);
console.log(`NATIVE_PUSH_QA activation_result=${activationReady ? "ready" : "pending"}`);
console.log(
  `NATIVE_PUSH_QA delivery_evidence=${checkByKey.get("delivery_evidence") ? "ready" : "required"}`,
);

if (!activationReady) {
  console.log("NATIVE_PUSH_QA next=complete private platform configuration, runtime activation, and Android/iOS delivery evidence");
}

if (requireReady && !activationReady) process.exit(1);
