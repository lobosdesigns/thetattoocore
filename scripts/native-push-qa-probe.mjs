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
  iosProject: `${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`,
  packageJson: `${wrapperRoot}/package.json`,
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

const checks = [
  {
    key: "bridge_dependency",
    ready:
      source.packageJson.includes('"@capacitor/push-notifications": "7.0.7"') &&
      source.androidPluginSettings.includes("include ':capacitor-push-notifications'") &&
      source.androidPluginBuild.includes("implementation project(':capacitor-push-notifications')"),
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
    key: "client_registration_flow",
    ready:
      clientSource.includes("@capacitor/push-notifications") &&
      clientSource.includes("PushNotifications.checkPermissions") &&
      clientSource.includes("PushNotifications.requestPermissions") &&
      clientSource.includes("PushNotifications.register") &&
      clientSource.includes("pushNotificationActionPerformed"),
  },
];

for (const check of checks) {
  console.log(`NATIVE_PUSH_QA ${check.key}=${check.ready ? "ready" : "pending"}`);
}

const configReady = checks
  .filter((check) => check.key !== "client_registration_flow")
  .every((check) => check.ready);
const activationReady = checks.every((check) => check.ready);

console.log(`NATIVE_PUSH_QA staging_guard=${androidActivationLocked ? "ready" : "pending"}`);
console.log(`NATIVE_PUSH_QA config_result=${configReady ? "ready" : "pending"}`);
console.log(`NATIVE_PUSH_QA activation_result=${activationReady ? "ready" : "pending"}`);
console.log("NATIVE_PUSH_QA delivery_evidence=required");

if (!activationReady) {
  console.log("NATIVE_PUSH_QA next=complete private platform configuration and tested opt-in registration before activation");
}

if (requireReady && !activationReady) process.exit(1);
