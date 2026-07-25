import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} must exist`);
  return readFileSync(absolutePath, "utf8");
}

const androidController = read(
  "native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/notifications/TtcMessagingOptOutController.java",
);
const androidPlugin = read(
  "native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/notifications/TtcFirebaseMessagingPlugin.java",
);
const androidControllerTest = read(
  "native/thetattoocore-mobile/android/app/src/test/java/com/thetattoocore/app/notifications/TtcMessagingOptOutControllerTest.java",
);
const mainActivity = read(
  "native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/MainActivity.java",
);
const androidManifest = read(
  "native/thetattoocore-mobile/android/app/src/main/AndroidManifest.xml",
);
const iosController = read(
  "native/thetattoocore-mobile/ios/App/App/TtcNativeMessagingOptOutController.swift",
);
const iosBridge = read(
  "native/thetattoocore-mobile/ios/App/App/TtcFirebaseMessagingOptOutBridge.swift",
);
const iosControllerTest = read(
  "native/thetattoocore-mobile/ios/Tests/TtcNativeMessagingOptOutControllerTests.swift",
);
const appDelegate = read(
  "native/thetattoocore-mobile/ios/App/App/AppDelegate.swift",
);
const infoPlist = read(
  "native/thetattoocore-mobile/ios/App/App/Info.plist",
);
const xcodeProject = read(
  "native/thetattoocore-mobile/ios/App/App.xcodeproj/project.pbxproj",
);
const androidGetToken = androidController.slice(
  androidController.indexOf("public void getToken"),
  androidController.indexOf("public void disable"),
);
const androidPrepareDeletion = androidController.slice(
  androidController.indexOf(
    "private synchronized boolean prepareDeletionIfReady",
  ),
  androidController.indexOf("private void startDeletion"),
);
const iosControllerClass = iosController.slice(
  iosController.indexOf("final class TtcNativeMessagingOptOutController"),
);
const iosGetToken = iosControllerClass.slice(
  iosControllerClass.indexOf("func getToken"),
  iosControllerClass.indexOf("func disable"),
);
const iosPrepareDeletion = iosControllerClass.slice(
  iosControllerClass.indexOf("private func prepareDeletionIfReadyLocked"),
  iosControllerClass.indexOf("private func startDeletion"),
);

assert.match(
  androidManifest,
  /android:name="firebase_messaging_auto_init_enabled"\s+android:value="false"/s,
  "Android launch must keep messaging auto-init off",
);
assert.match(
  infoPlist,
  /<key>FirebaseMessagingAutoInitEnabled<\/key>\s*<false\/>/s,
  "iOS launch must keep messaging auto-init off",
);

assert.ok(
  androidController.indexOf("setAutoInitEnabled(false)") <
    androidController.indexOf("startDeletion()"),
  "Android must disable auto-init before starting token deletion",
);
assert.match(
  androidGetToken,
  /synchronized \(this\) \{[\s\S]*client\.setAutoInitEnabled\(true\);[\s\S]*\}\s*if \(autoInitError/,
  "Android must serialize auto-init enable against concurrent opt-out",
);
assert.match(
  androidControllerTest,
  /optOutCannotBeOvertakenByConcurrentAutoInitEnable/,
  "Android must test the concurrent auto-init opt-out race",
);
assert.doesNotMatch(
  androidPrepareDeletion,
  /activeTokenRequests/,
  "Android opt-out must delete without waiting on a stalled token request",
);
assert.match(
  androidController,
  /if \(!optOutInProgress\) \{[\s\S]*optOutInProgress = true;[\s\S]*autoInitDisabledForOptOut = true;/,
  "Android must restart cleanup when a late token arrives after opt-out",
);
assert.match(
  androidControllerTest,
  /optOutDeletesImmediatelyThenRetiresLateToken/,
  "Android must test immediate and late-token deletion",
);
assert.match(
  androidControllerTest,
  /stalledTokenDoesNotBlockLaterOptIn/,
  "Android must test opt-in recovery from a stalled old token request",
);
assert.match(
  androidControllerTest,
  /lateTokenDuringDeletionQueuesFollowUpDelete/,
  "Android must test follow-up deletion when a token arrives mid-delete",
);
assert.match(
  androidPlugin,
  /class TtcFirebaseMessagingPlugin extends FirebaseMessagingPlugin/,
  "Android must use an app-local Firebase Messaging bridge",
);
assert.match(
  androidPlugin,
  /TOKEN_RECEIVED_EVENT\.equals\(eventName\)[\s\S]*allowsTokenEvent\(\)/,
  "Android must suppress late token events after opt-out",
);
assert.ok(
  mainActivity.indexOf("super.onCreate(savedInstanceState)") <
    mainActivity.indexOf(
      "getBridge().registerPlugin(TtcFirebaseMessagingPlugin.class)",
    ),
  "Android must replace the generated plugin handle after bridge creation",
);

assert.ok(
  iosController.indexOf("setAutoInitEnabled(false)") <
    iosController.indexOf("startDeletion()"),
  "iOS must disable auto-init before starting token deletion",
);
assert.match(
  iosGetToken,
  /tokenEventsEnabled = true[\s\S]*client\.setAutoInitEnabled\(true\)[\s\S]*lock\.unlock\(\)/,
  "iOS must serialize auto-init enable against concurrent opt-out",
);
assert.match(
  iosControllerTest,
  /testOptOutCannotBeOvertakenByConcurrentAutoInitEnable/,
  "iOS must test the concurrent auto-init opt-out race",
);
assert.doesNotMatch(
  iosPrepareDeletion,
  /activeTokenRequests/,
  "iOS opt-out must delete without waiting on a stalled token request",
);
assert.match(
  iosController,
  /if !optOutInProgress \{[\s\S]*optOutInProgress = true[\s\S]*autoInitDisabledForOptOut = true/,
  "iOS must restart cleanup when a late token arrives after opt-out",
);
assert.match(
  iosControllerTest,
  /testOptOutDeletesImmediatelyThenRetiresLateToken/,
  "iOS must test immediate and late-token deletion",
);
assert.match(
  iosControllerTest,
  /testStalledTokenDoesNotBlockLaterOptIn/,
  "iOS must test opt-in recovery from a stalled old token request",
);
assert.match(
  iosControllerTest,
  /testLateTokenDuringDeletionQueuesFollowUpDelete/,
  "iOS must test follow-up deletion when a token arrives mid-delete",
);
assert.match(
  iosBridge,
  /let getTokenMethod = class_getInstanceMethod[\s\S]*let deleteTokenMethod = class_getInstanceMethod[\s\S]*let tokenEventMethod = class_getInstanceMethod/,
  "iOS must preflight every bridge hook before installation",
);
assert.ok(
  iosBridge.indexOf("installTokenEventFilter(") <
    iosBridge.indexOf("replacePluginMethod("),
  "iOS must install the event filter before replacing token methods",
);
assert.match(
  iosBridge,
  /selector: getTokenSelector[\s\S]*selector: deleteTokenSelector/,
  "iOS must replace both installed token bridge methods",
);
assert.match(
  iosBridge,
  /eventName == "tokenReceived"[\s\S]*allowsTokenEvent\(\)/,
  "iOS must suppress late token events after opt-out",
);
assert.ok(
  appDelegate.indexOf("TtcFirebaseMessagingOptOutBridge.install()") <
    appDelegate.indexOf("return true"),
  "iOS bridge hardening must install before launch completes",
);
assert.match(
  xcodeProject,
  /TtcNativeMessagingOptOutController\.swift in Sources/,
  "iOS opt-out controller must belong to the App target",
);
assert.match(
  xcodeProject,
  /TtcFirebaseMessagingOptOutBridge\.swift in Sources/,
  "iOS opt-out bridge must belong to the App target",
);

console.log("Native notification opt-out guards passed.");
