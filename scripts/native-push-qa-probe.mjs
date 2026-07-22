import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requireReady = process.argv.includes("--require-ready");
const wrapperRoot = "native/thetattoocore-mobile";

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
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
  nativeDevicesMigration: "supabase/migrations/20260722114857_native_push_devices.sql",
  packageJson: `${wrapperRoot}/package.json`,
  rootPackageJson: "package.json",
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, read(path)]),
);

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
const androidActivationLocked =
  /<meta-data\s+android:name="firebase_messaging_auto_init_enabled"\s+android:value="false"\s*\/>/s.test(
    source.androidManifest,
  ) &&
  /<meta-data\s+android:name="firebase_analytics_collection_enabled"\s+android:value="false"\s*\/>/s.test(
    source.androidManifest,
  ) &&
  source.androidManifest.includes('android:name="android.permission.POST_NOTIFICATIONS"') &&
  source.androidManifest.includes('tools:node="remove"');
const iosActivationLocked =
  /<key>FirebaseMessagingAutoInitEnabled<\/key>\s*<false\/>/s.test(
    source.iosInfo,
  ) && !source.iosEntitlements.includes("aps-environment");

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
    ready: existsSync(files.androidConfig),
  },
  {
    key: "android_services_hook",
    ready:
      source.androidAppBuild.includes("def servicesJSON = file('google-services.json')") &&
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
    ready: existsSync(files.iosConfig),
  },
  {
    key: "ios_config_target",
    ready: source.iosProject.includes("GoogleService-Info.plist"),
  },
  {
    key: "ios_push_capability",
    ready:
      source.iosEntitlements.includes("aps-environment") &&
      source.iosProject.includes("CODE_SIGN_ENTITLEMENTS"),
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
  "installed_build_registration",
];
const privateConfigCheckKeys = [
  "android_private_config",
  "ios_private_config",
  "ios_config_target",
];
const activationCheckKeys = [
  ...bridgeCheckKeys,
  ...privateConfigCheckKeys,
  "android_permission_enabled",
  "ios_push_capability",
];
const checksReady = (keys) => keys.every((key) => checkByKey.get(key) === true);
const bridgeReady = checksReady(bridgeCheckKeys);
const privateConfigReady = checksReady(privateConfigCheckKeys);
const stagingGuardReady = androidActivationLocked && iosActivationLocked;
const activationReady = checksReady(activationCheckKeys);

console.log(`NATIVE_PUSH_QA bridge_result=${bridgeReady ? "ready" : "pending"}`);
console.log(
  `NATIVE_PUSH_QA private_config_result=${privateConfigReady ? "ready" : "pending"}`,
);
console.log(`NATIVE_PUSH_QA staging_guard=${stagingGuardReady ? "ready" : "pending"}`);
console.log(`NATIVE_PUSH_QA activation_result=${activationReady ? "ready" : "pending"}`);
console.log("NATIVE_PUSH_QA delivery_evidence=required");

if (!activationReady) {
  console.log("NATIVE_PUSH_QA next=complete private platform configuration and tested opt-in registration before activation");
}

if (requireReady && !activationReady) process.exit(1);
