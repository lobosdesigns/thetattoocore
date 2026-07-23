import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const wrapperRoot = "native/thetattoocore-mobile";
const files = {
  androidAppBuild: `${wrapperRoot}/android/app/build.gradle`,
  androidRootBuild: `${wrapperRoot}/android/build.gradle`,
  androidManifest: `${wrapperRoot}/android/app/src/main/AndroidManifest.xml`,
  androidPluginBuild: `${wrapperRoot}/android/app/capacitor.build.gradle`,
  androidPluginSettings: `${wrapperRoot}/android/capacitor.settings.gradle`,
  androidVariables: `${wrapperRoot}/android/variables.gradle`,
  capacitorConfig: `${wrapperRoot}/capacitor.config.ts`,
  iosBuildScript: `${wrapperRoot}/ios/build-testflight.sh`,
  iosBootstrapScript: `${wrapperRoot}/ios/mac-bootstrap-testflight.sh`,
  iosExportOptions: `${wrapperRoot}/ios/ExportOptions-AppStore.template.plist`,
  iosInfo: `${wrapperRoot}/ios/App/App/Info.plist`,
  iosPodfile: `${wrapperRoot}/ios/App/Podfile`,
  iosPodfileLock: `${wrapperRoot}/ios/App/Podfile.lock`,
  iosPrivacy: `${wrapperRoot}/ios/App/App/PrivacyInfo.xcprivacy`,
  iosEntitlements: `${wrapperRoot}/ios/App/App/App.entitlements`,
  iosProject: `${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`,
  iosUploadChecklist: `${wrapperRoot}/ios/APPLE_UPLOAD_CHECKLIST.md`,
  dataSafetyPrep: "docs/DATA_SAFETY_PREP.md",
  gitignore: ".gitignore",
  mobileRunbook: "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md",
  mobileSmoke: "scripts/smoke-mobile-browser.mjs",
  middleware: "src/middleware.ts",
  nativePrep: "docs/NATIVE_WRAPPER_PREP.md",
  nativeAppUrl: "src/lib/native-app-url.ts",
  nativeAppUrlBridge: "src/app/native-app-url-bridge.tsx",
  nativeAppUrlTest: "scripts/test-native-app-url.mjs",
  rootLayout: "src/app/layout.tsx",
  nativePushProbe: "scripts/native-push-qa-probe.mjs",
  appLinkSmoke: "scripts/smoke-app-link-associations.mjs",
  realDeviceQa: "docs/REAL_DEVICE_QA_CHECKLIST.md",
  readiness: "docs/APP_STORE_READINESS.md",
  androidDeviceProbe: "scripts/android-device-qa-probe.mjs",
  appLinkAssociation: "src/lib/app-link-association.ts",
  androidAssetLinksRoute: "src/app/.well-known/assetlinks.json/route.ts",
  appleAssociationRoute: "src/app/.well-known/apple-app-site-association/route.ts",
  envExample: ".env.example",
  rootPackageJson: "package.json",
  packageJson: `${wrapperRoot}/package.json`,
  readme: `${wrapperRoot}/README.md`,
  webFallback: `${wrapperRoot}/www/index.html`,
  webLoadError: `${wrapperRoot}/www/load-error.html`,
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [
    key,
    existsSync(path) ? readFileSync(path, "utf8") : "",
  ]),
);

const fileSize = (path) => (existsSync(path) ? statSync(path).size : 0);

function filesUnder(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) return filesUnder(entryPath);

    return [entryPath];
  });
}

const forbiddenNativePushConfigFiles = [
  "google-services.json",
  "GoogleService-Info.plist",
];
function trackedFilesUnder(root) {
  try {
    return execFileSync("git", ["ls-files", "--", root], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return filesUnder(root);
  }
}

const checkedInNativePushConfigFiles = trackedFilesUnder(wrapperRoot).filter((path) =>
  forbiddenNativePushConfigFiles.some((fileName) => path.endsWith(fileName)),
);
const committedIosTeamId = /DEVELOPMENT_TEAM = [A-Z0-9]{10};/.test(source.iosProject);
const forbiddenNativePushDependencies = [
  "@react-native-firebase/app",
  "@react-native-firebase/messaging",
];

const nativeSourceForLeakChecks = Object.entries(source)
  .filter(
    ([key]) =>
      key !== "nativePrep" &&
      key !== "mobileRunbook" &&
      key !== "envExample" &&
      key !== "middleware" &&
      key !== "nativePushProbe",
  )
  .map(([key, content]) => `${key}\n${content}`)
  .join("\n");

const forbiddenNativeTokens = [
  "NEXT_PUBLIC_",
  "SUPABASE",
  "STRIPE",
  "HOSTGATOR",
  "SERVICE_ROLE",
  "SECRET",
  "WEBHOOK",
  "API_KEY",
];
const nativeLeakTokens = forbiddenNativeTokens.filter((token) =>
  nativeSourceForLeakChecks.includes(token),
);

function gradleNumber(name) {
  const match = source.androidVariables.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));

  return match ? Number.parseInt(match[1], 10) : NaN;
}

const compileSdkVersion = gradleNumber("compileSdkVersion");
const targetSdkVersion = gradleNumber("targetSdkVersion");
const androidSdkPair = `${compileSdkVersion} / ${targetSdkVersion}`;
const androidVersionCode =
  Number.parseInt(source.androidAppBuild.match(/versionCode\s+(\d+)/)?.[1] ?? "", 10);
const androidVersionName =
  source.androidAppBuild.match(/versionName\s+"([^"]+)"/)?.[1] ?? "";
const androidApi36SubmissionReady = compileSdkVersion >= 36 && targetSdkVersion >= 36;
const androidApi36DocsReady =
  androidApi36SubmissionReady &&
  androidVersionCode >= 3 &&
  androidVersionName === "1.0.2" &&
  source.nativePrep.includes("Active release `1.0.2 (3)` and checked-in wrapper are `36 / 36`") &&
  source.nativePrep.includes("Record API `36 / 36` rebuild proof") &&
  source.nativePrep.includes("current closed-test release is version code `3` / version name `1.0.2`") &&
  source.nativePrep.includes("Any replacement must increment above version code `3`") &&
  source.mobileRunbook.includes("checked-in Android wrapper and active closed-test release `1.0.2 (3)`") &&
  source.mobileRunbook.includes("Any replacement or later update must increment the version code above `3`") &&
  source.readme.includes("checked-in wrapper targets `36 / 36`") &&
  source.readme.includes("Closed testing - Alpha is active with version code `3` / version name `1.0.2`") &&
  source.readme.includes("| Current Play closed-test release | `36 / 36`; active `3` / `1.0.2` |");
const androidApi35InternalOnly =
  compileSdkVersion === 35 &&
  targetSdkVersion === 35 &&
  source.nativePrep.includes("API 35 is internal-test-only") &&
  source.nativePrep.includes("not public-submission-ready") &&
  source.mobileRunbook.includes("API 35 is internal-test-only") &&
  source.readme.includes("API 35 is internal-test-only") &&
  source.nativePrep.includes("| Google Play internal testing before the API 36 deadline | `35 / 35` |") &&
  source.nativePrep.includes("| Google Play public submission or update on or after August 31, 2026 | `35 / 35` is blocked |") &&
  source.nativePrep.includes("Record API `36 / 36` rebuild proof") &&
  source.readme.includes("| Internal testing before the API 36 deadline | `35 / 35` |") &&
  source.readme.includes("| Public submission or update on or after August 31, 2026 | `35 / 35` |") &&
  source.readme.includes("rebuilt at `36 / 36`");
const hardcodedAndroidFingerprint =
  /([A-F0-9]{2}:){31}[A-F0-9]{2}/i.test(source.appLinkAssociation) ||
  /([A-F0-9]{2}:){31}[A-F0-9]{2}/i.test(source.androidAssetLinksRoute);
const hardcodedAppleAppId =
  /[A-Z0-9]{10}\.com\.thetattoocore\.app/i.test(source.appLinkAssociation) ||
  /[A-Z0-9]{10}\.com\.thetattoocore\.app/i.test(source.appleAssociationRoute);

const iosProjectBuildVersions = [
  ...source.iosProject.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g),
].map((match) => match[1]);
const iosCurrentBuildVersion = iosProjectBuildVersions[0] ?? "";
const iosBuildVersionsMatch =
  iosProjectBuildVersions.length > 0 &&
  iosProjectBuildVersions.every((version) => version === iosCurrentBuildVersion);
const iosProjectMarketingVersions = [
  ...source.iosProject.matchAll(/MARKETING_VERSION = ([^;]+);/g),
].map((match) => match[1]);
const iosCurrentMarketingVersion =
  iosProjectMarketingVersions[0] ?? "";
const iosMarketingVersionsMatch =
  iosProjectMarketingVersions.length > 0 &&
  iosProjectMarketingVersions.every((version) => version === iosCurrentMarketingVersion);
const iosCurrentStoreBuild = `${iosCurrentMarketingVersion} (${iosCurrentBuildVersion})`;

const checks = [
  {
    label: "native wrapper scaffold exists for Android and iOS beta builds",
    ok:
      Object.values(files).every((path) => existsSync(path)) &&
      existsSync(`${wrapperRoot}/android/settings.gradle`) &&
      existsSync(`${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`),
  },
  {
    label: "native wrapper starts at the production login route",
    ok:
      source.capacitorConfig.includes('appId: "com.thetattoocore.app"') &&
      source.capacitorConfig.includes('appName: "TheTattooCore"') &&
      source.capacitorConfig.includes('url: "https://thetattoocore.com/login"') &&
      source.capacitorConfig.includes('allowNavigation: ["thetattoocore.com", "www.thetattoocore.com"]') &&
      !source.capacitorConfig.includes("bundledWebRuntime") &&
      source.webFallback.includes("https://thetattoocore.com/login"),
  },
  {
    label: "native wrapper has a safe main-load recovery screen",
    ok:
      source.capacitorConfig.includes('errorPath: "load-error.html"') &&
      source.webLoadError.includes("The app couldn't load") &&
      source.webLoadError.includes("Check your connection, then try again.") &&
      source.webLoadError.includes('href="https://thetattoocore.com/login"') &&
      source.webLoadError.includes(">Try again</a>") &&
      source.webLoadError.includes("env(safe-area-inset-top)") &&
      source.webLoadError.includes("env(safe-area-inset-bottom)") &&
      !source.webLoadError.includes('http-equiv="refresh"') &&
      !source.webLoadError.includes("<script"),
  },
  {
    label: "native Android WebView stays inside enforced system-bar insets",
    ok:
      source.capacitorConfig.includes('adjustMarginsForEdgeToEdge: "auto"') &&
      source.androidAppBuild.includes('applicationIdSuffix ".qa"') &&
      source.androidAppBuild.includes('"TheTattooCore QA"') &&
      source.readme.includes("automatic Android system-bar inset margins") &&
      source.readme.includes("side-by-side QA package") &&
      source.nativePrep.includes("clock, status icons,") &&
      source.nativePrep.includes("camera cutout, or navigation controls"),
  },
  {
    label: "native wrapper avoids provider, secret, and environment-token leakage",
    ok: nativeLeakTokens.length === 0,
    message: nativeLeakTokens.length
      ? `Remove native wrapper leak marker(s): ${nativeLeakTokens.join(", ")}`
      : undefined,
  },
  {
    label: "native wrapper keeps TestFlight auth navigation inside the app",
    ok:
      source.capacitorConfig.includes('allowNavigation: ["thetattoocore.com", "www.thetattoocore.com"]') &&
      source.mobileSmoke.includes('path: "/auth/confirm?next=%2Fmessages&code=bad"') &&
      source.nativePrep.includes("Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView") &&
      source.mobileRunbook.includes("Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView") &&
      source.mobileSmoke.includes('path: "/api/bookings/bad/calendar"') &&
      source.iosUploadChecklist.includes("Confirm login, signup, forgot password, reset password, and email confirmation stay inside the app WebView"),
  },
  {
    label: "native wrapper declares and handles safe TTC shared-link routing",
    ok:
      source.androidManifest.includes('android.intent.action.VIEW') &&
      source.androidManifest.includes('android:autoVerify="true"') &&
      source.androidManifest.includes('android.intent.category.BROWSABLE') &&
      source.androidManifest.includes('android:host="thetattoocore.com"') &&
      source.androidManifest.includes('android:host="www.thetattoocore.com"') &&
      source.rootLayout.includes("<NativeAppUrlBridge />") &&
      source.nativeAppUrlBridge.includes('App.addListener("appUrlOpen"') &&
      source.nativeAppUrlBridge.includes("App.getLaunchUrl()") &&
      source.nativeAppUrlBridge.includes('navigate(event.url, "push")') &&
      source.nativeAppUrlBridge.includes('navigate(launch?.url, "replace")') &&
      source.nativeAppUrlBridge.includes("createdHandle.remove()") &&
      source.nativeAppUrl.includes('"https://thetattoocore.com"') &&
      source.nativeAppUrl.includes('"https://www.thetattoocore.com"') &&
      source.nativeAppUrl.includes("!nativeAppOrigins.has(url.origin)") &&
      source.nativeAppUrlTest.includes("external origin is rejected") &&
      source.nativeAppUrlTest.includes("lookalike subdomain is rejected") &&
      source.nativePrep.includes("Deep-link wiring is started in the wrapper") &&
      source.nativePrep.includes("iOS universal links are deferred for the first TestFlight build") &&
      source.nativePrep.includes("support, Child Safety Standards, privacy, and terms routes") &&
      source.mobileRunbook.includes("Confirm public shared links open in the wrapper"),
  },
  {
    label: "native wrapper keeps verified app-link evidence private and route-complete",
    ok:
      source.nativePrep.includes("## Verified Link Evidence Matrix") &&
      source.nativePrep.includes("| Platform | Association file | Native entitlement or manifest proof | Device proof | Repo-safe result |") &&
      source.nativePrep.includes("`/.well-known/assetlinks.json`") &&
      source.nativePrep.includes("Google Play app-signing certificate fingerprint") &&
      source.nativePrep.includes('android:autoVerify="true"') &&
      source.nativePrep.includes("`/.well-known/apple-app-site-association`") &&
      source.nativePrep.includes("Associated Domains capability") &&
      source.nativePrep.includes("profile, post, Story, Gossip, Stuff, Gigs, Merch, booking, Support, Child Safety Standards, Privacy, and Terms links") &&
      source.nativePrep.includes("Do not treat URL scheme handling, simulator-only checks, browser-sized mobile QA") &&
      source.nativePrep.includes("Do not commit signing") &&
      source.mobileRunbook.includes("Verified app-link and universal-link proof should use the matrix") &&
      source.readme.includes("Verified app-link evidence should follow") &&
      source.readme.includes("without committing fingerprints, team identifiers, provisioning details, console screenshots, tester accounts, or raw device logs"),
  },
  {
    label: "well-known association routes are private-env gated and fail closed",
    ok:
      source.androidAssetLinksRoute.includes("androidAssetLinksPayload") &&
      source.androidAssetLinksRoute.includes("unavailableAssociationResponse") &&
      source.appleAssociationRoute.includes("appleAppSiteAssociationPayload") &&
      source.appleAssociationRoute.includes("unavailableAssociationResponse") &&
      source.middleware.includes('request.nextUrl.pathname === "/.well-known/assetlinks.json"') &&
      source.middleware.includes('request.nextUrl.pathname === "/.well-known/apple-app-site-association"') &&
      source.appLinkAssociation.includes("TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS") &&
      source.appLinkAssociation.includes("TTC_IOS_APP_LINK_APP_IDS") &&
      source.appLinkAssociation.includes("delegate_permission/common.handle_all_urls") &&
      source.appLinkAssociation.includes("sha256_cert_fingerprints") &&
      source.appLinkAssociation.includes("Association file is not available for this build.") &&
      source.appLinkAssociation.includes("cache-control") &&
      source.appLinkSmoke.includes('"/.well-known/assetlinks.json"') &&
      source.appLinkSmoke.includes('"/.well-known/apple-app-site-association"') &&
      source.appLinkSmoke.includes("validateAndroidPayload") &&
      source.appLinkSmoke.includes("validateIosPayload") &&
      source.appLinkSmoke.includes("fail-closed until private identifiers are configured") &&
      source.rootPackageJson.includes('"smoke:app-links": "node scripts/smoke-app-link-associations.mjs"') &&
      source.rootPackageJson.includes("npm run smoke:native && npm run test:native-push-delivery && npm run smoke:native-push && npm run smoke:app-links && npm run smoke:handoff") &&
      source.nativePrep.includes("fail-closed `.well-known` association routes") &&
      source.nativePrep.includes("Run `npm.cmd run smoke:app-links` after deployment") &&
      source.nativePrep.includes("private deployment environment") &&
      source.mobileRunbook.includes("fail-closed `.well-known` association routes") &&
      source.mobileRunbook.includes("Run `npm.cmd run smoke:app-links` after every deploy") &&
      source.envExample.includes("TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS=replace_with_google_play_app_signing_sha256_fingerprints") &&
      source.envExample.includes("TTC_IOS_APP_LINK_APP_IDS=replace_with_apple_team_id_dot_bundle_id") &&
      !hardcodedAndroidFingerprint &&
      !hardcodedAppleAppId,
  },
  {
    label: "native wrapper keeps launch permissions minimal",
    ok:
      source.androidManifest.includes("android.permission.INTERNET") &&
      source.androidManifest.includes('android:name="android.permission.POST_NOTIFICATIONS"') &&
      !source.androidManifest.includes('tools:node="remove"') &&
      !source.androidManifest.includes("android.permission.CAMERA") &&
      !source.androidManifest.includes("android.permission.RECORD_AUDIO") &&
      !source.androidManifest.includes("android.permission.ACCESS_FINE_LOCATION") &&
      !source.androidManifest.includes("android.permission.READ_CONTACTS") &&
      source.iosEntitlements.includes("aps-environment") &&
      source.iosProject.includes("com.apple.Push = {") &&
      source.iosInfo.includes("FirebaseMessagingAutoInitEnabled") &&
      !source.iosInfo.includes("NSCameraUsageDescription") &&
      !source.iosInfo.includes("NSMicrophoneUsageDescription") &&
      !source.iosInfo.includes("NSLocationWhenInUseUsageDescription") &&
      !source.iosInfo.includes("NSContactsUsageDescription"),
  },
  {
    label: "native wrapper is privacy and review conservative for beta",
    ok:
      source.androidManifest.includes('android:allowBackup="false"') &&
      source.androidManifest.includes('android:screenOrientation="portrait"') &&
      source.iosInfo.includes("<string>UIInterfaceOrientationPortrait</string>") &&
      source.iosInfo.includes("<key>UISupportedInterfaceOrientations~ipad</key>") &&
      source.iosInfo.includes("<string>UIInterfaceOrientationPortraitUpsideDown</string>") &&
      source.iosInfo.includes("<string>UIInterfaceOrientationLandscapeLeft</string>") &&
      source.iosInfo.includes("<string>UIInterfaceOrientationLandscapeRight</string>") &&
      source.iosInfo.includes("ITSAppUsesNonExemptEncryption") &&
      source.capacitorConfig.includes("cleartext: false"),
  },
  {
    label: "native wrapper notes keep TestFlight and Play closed/internal first",
    ok:
      source.readme.includes("Apple TestFlight") &&
      source.readme.includes("Google Play closed/internal testing") &&
      source.readme.includes("Public release waits for final legal review") &&
      source.nativePrep.includes("August 31, 2026") &&
      source.nativePrep.includes("Android 16 / API 36") &&
      source.mobileRunbook.includes("checked-in Android wrapper and active closed-test release `1.0.2 (3)`") &&
      source.readme.includes("support@thetattoocore.com") &&
      source.readme.includes("Native permissions at first beta: none") &&
      source.readme.includes("Push prompts: off") &&
      source.mobileSmoke.includes('path: "/settings/notifications"') &&
      source.mobileSmoke.includes("SMOKE_MOBILE_PROFILE") &&
      source.mobileSmoke.includes("iPhone Safari") &&
      source.readme.includes("If the probe reports `devices_total=0`") &&
      source.readme.includes("set USB mode") &&
      source.readme.includes("accept the computer authorization prompt") &&
      source.readme.includes("authorized device missing TTC package") &&
      source.readme.includes("Closed testing - Alpha is active") &&
      source.readme.includes("tester participation/duration evidence") &&
      source.readme.includes("reviewer messages archived privately") &&
      source.mobileRunbook.includes("Firebase Cloud Messaging") &&
      source.mobileRunbook.includes("Do not request native notification permission"),
  },
  {
    label: "Android connected-device probe requires installed TTC package for route QA",
    ok:
      source.androidDeviceProbe.includes("let packageInstalled = false") &&
      source.androidDeviceProbe.includes("packageInstalled = true") &&
      source.androidDeviceProbe.includes("function expectedAndroidBuild") &&
      source.androidDeviceProbe.includes("TTC_ANDROID_EXPECTED_VERSION_NAME") &&
      source.androidDeviceProbe.includes("TTC_ANDROID_EXPECTED_VERSION_CODE") &&
      source.androidDeviceProbe.includes("ANDROID_QA expected_versionName=") &&
      source.androidDeviceProbe.includes("ANDROID_QA expected_versionCode=") &&
      source.androidDeviceProbe.includes("ANDROID_QA expected_targetSdk=") &&
      source.androidDeviceProbe.includes("ANDROID_QA installed_targetSdk=") &&
      source.androidDeviceProbe.includes("TTC_ANDROID_EXPECTED_TARGET_SDK") &&
      source.androidDeviceProbe.includes("targetSdkMatches") &&
      source.androidDeviceProbe.includes("ANDROID_QA result=authorized device has wrong TTC build") &&
      source.androidDeviceProbe.includes("ANDROID_QA result=authorized device missing TTC package") &&
      source.androidDeviceProbe.includes("--open-test-join") &&
      source.androidDeviceProbe.includes("--open-app-link") &&
      source.androidDeviceProbe.includes("ANDROID_QA closed_test_join_url=") &&
      source.androidDeviceProbe.includes("ANDROID_QA play_store_url=") &&
      source.androidDeviceProbe.includes("ANDROID_QA closed_test_join=open requested") &&
      source.androidDeviceProbe.includes("ANDROID_QA app_link_domains=") &&
      source.androidDeviceProbe.includes("ANDROID_QA app_link_selection=") &&
      source.androidDeviceProbe.includes("ANDROID_QA app_link_open=") &&
      source.androidDeviceProbe.includes("ANDROID_QA app_link_open=skipped until verified and enabled") &&
      source.androidDeviceProbe.includes("ANDROID_QA result=verified app links are not ready") &&
      source.androidDeviceProbe.includes("ANDROID_QA wait_ms=") &&
      source.androidDeviceProbe.includes("ANDROID_QA next=check USB cable, set USB mode to file transfer, and reopen the USB debugging prompt") &&
      source.androidDeviceProbe.includes("ANDROID_QA next=unlock device, enable USB debugging, and accept the computer authorization prompt") &&
      source.androidDeviceProbe.includes("ANDROID_QA next=join the active Google Play closed test, install its exact build, and rerun route QA") &&
      source.readme.includes("confirm the Google Play closed-testing build before route QA") &&
      source.readme.includes("npm.cmd run qa:android-device:open-test") &&
      source.readme.includes("npm.cmd run qa:android-device:open-link") &&
      source.realDeviceQa.includes("npm.cmd run qa:android-device:open-test") &&
      source.realDeviceQa.includes("npm.cmd run qa:android-device:open-link") &&
      source.rootPackageJson.includes('"qa:android-device:open-test": "node scripts/android-device-qa-probe.mjs --open-test-join"') &&
      source.rootPackageJson.includes('"qa:android-device:open-link": "node scripts/android-device-qa-probe.mjs --require-device --open-app-link"') &&
      source.androidDeviceProbe.includes("if (requireDevice) process.exit(1)") &&
      source.realDeviceQa.includes("authorized device is visible and the TTC") &&
      source.realDeviceQa.includes("package is installed for the active closed-test build") &&
      source.realDeviceQa.includes("authorized device has wrong TTC build") &&
      source.realDeviceQa.includes("TTC_ANDROID_EXPECTED_VERSION_NAME") &&
      source.realDeviceQa.includes("authorized device missing TTC package") &&
      source.realDeviceQa.includes("waits briefly for the USB/debug authorization state to settle") &&
      source.realDeviceQa.includes("install or confirm the Play-installed build"),
  },
  {
    label: "Google Play closed-test evidence stays private and production-access ready",
    ok:
      source.mobileRunbook.includes("The signed-in Lobosdesigns LLC developer account is an organization account") &&
      source.mobileRunbook.includes("12-testers-for-14-days production-access gate applies to newly created personal accounts") &&
      source.mobileRunbook.includes("If a future personal account or console-specific requirement shows that gate") &&
      source.mobileRunbook.includes("controlled closed test with the existing tester community or Google Group") &&
      source.mobileRunbook.includes("archive the production-access evidence privately") &&
      source.mobileRunbook.includes("Recheck the console and official help before future submissions.") &&
      source.realDeviceQa.includes("Google Play closed testing") &&
      source.realDeviceQa.includes("closed-test date range for the exact build under review") &&
      source.realDeviceQa.includes("same-account web opt-in, 12-tester participation, 14-day duration, feedback summary, and production-access request result in the private handoff") &&
      source.realDeviceQa.includes("Repo-safe summary fields are limited to platform, release channel, version/build, date, device model, and pass/fail status"),
  },
  {
    label: "native push plan keeps Firebase gated behind app config and device evidence",
    ok:
      source.nativePrep.includes("## Native Push Plan") &&
      source.nativePrep.includes("Firebase Cloud Messaging") &&
      source.nativePrep.includes("package name `com.thetattoocore.app`") &&
      source.nativePrep.includes("Apple bundle identifier, team, signing profile, and notification capability") &&
      source.nativePrep.includes("Keep push prompts off") &&
      source.nativePrep.includes("per-device opt-out, quiet hours, and notification-category preferences") &&
      source.nativePrep.includes("notification tap routing") &&
      source.nativePrep.includes("Enable Firebase/FCM notification delivery only after") &&
      source.nativePrep.includes("## Native Push Private Evidence Matrix") &&
      source.nativePrep.includes("| Firebase project | Project exists for TheTattooCore") &&
      source.nativePrep.includes("| Android app config | Android app config file added only to the private build environment") &&
      source.nativePrep.includes("| iOS app config | Checked-in build `1.0 (4)` references the ignored private app config") &&
      source.nativePrep.includes("| Device token registration | Signed-in Android and iOS devices register and refresh tokens") &&
      source.nativePrep.includes("| Delivery and tap routing | Alerts deliver for the tested categories") &&
      source.nativePrep.includes("| Preference controls | Per-device opt-out, quiet hours, and category preferences stop delivery") &&
      source.nativePrep.includes("no project IDs, sender IDs, API keys, or console screenshots") &&
      source.nativePrep.includes("Do not claim native push support in store metadata") &&
      source.mobileRunbook.includes("Firebase project, native app config files") &&
      source.mobileRunbook.includes("Android and iOS device-token registration") &&
      source.mobileRunbook.includes("alert delivery, notification tap routing, opt-out") &&
      source.mobileRunbook.includes("Use the Native Push Private Evidence Matrix") &&
      source.mobileRunbook.includes("Keep project IDs, sender IDs, API keys, app config files, device tokens, notification payloads, signing details, and console screenshots in the private release handoff only"),
  },
  {
    label: "native push bridge stays inert and private config stays untracked before device evidence",
    ok:
      checkedInNativePushConfigFiles.length === 0 &&
      source.packageJson.includes('"@capacitor-firebase/messaging": "7.5.0"') &&
      source.packageJson.includes('"firebase": "11.10.0"') &&
      !source.packageJson.includes('"@capacitor/push-notifications"') &&
      source.androidPluginSettings.includes("include ':capacitor-firebase-messaging'") &&
      source.androidPluginBuild.includes("implementation project(':capacitor-firebase-messaging')") &&
      source.iosPodfile.includes("CapacitorFirebaseMessaging") &&
      source.androidManifest.includes('android:name="firebase_messaging_auto_init_enabled"') &&
      source.androidManifest.includes('android:name="firebase_analytics_collection_enabled"') &&
      source.iosInfo.includes("FirebaseMessagingAutoInitEnabled") &&
      source.iosInfo.includes("<false/>") &&
      source.androidManifest.includes('android:name="android.permission.POST_NOTIFICATIONS"') &&
      !source.androidManifest.includes('tools:node="remove"') &&
      forbiddenNativePushDependencies.every(
        (dependency) => !source.packageJson.includes(`"${dependency}"`),
      ) &&
      source.androidRootBuild.includes("com.google.gms:google-services") &&
      source.androidAppBuild.includes("def ttcServicesFile = file('google-services.json')") &&
      source.androidAppBuild.includes("def hasTtcServicesConfig = ttcServicesFile.isFile() && ttcServicesFile.length() > 0") &&
      source.androidAppBuild.includes("if (hasTtcServicesConfig)") &&
      source.androidAppBuild.includes("apply plugin: 'com.google.gms.google-services'") &&
      source.androidAppBuild.includes('task.name == "processDebugGoogleServices"') &&
      source.androidAppBuild.includes("enabled = false") &&
      source.androidAppBuild.includes('tasks.register("verifyTtcReleaseInputs")') &&
      source.androidAppBuild.includes('task.name == "preReleaseBuild"') &&
      source.androidAppBuild.includes('dependsOn tasks.named("verifyTtcReleaseInputs")') &&
      source.androidAppBuild.includes("TTC Android release signing is not configured.") &&
      source.androidAppBuild.includes("TTC Android release signing file is unavailable.") &&
      source.androidAppBuild.includes("TTC Android release app configuration is unavailable.") &&
      !source.androidAppBuild.includes("Push Notifications won't work") &&
      source.gitignore.includes("**/google-services.json") &&
      source.gitignore.includes("**/GoogleService-Info.plist") &&
      source.nativePushProbe.includes("NATIVE_PUSH_QA staging_guard=") &&
      source.nativePushProbe.includes("NATIVE_PUSH_QA bridge_result=") &&
      source.nativePushProbe.includes("NATIVE_PUSH_QA private_config_result=") &&
      source.nativePushProbe.includes("NATIVE_PUSH_QA activation_result=") &&
      !source.nativePushProbe.includes("const activationReady = checks.every") &&
      source.nativePushProbe.includes("NATIVE_PUSH_QA delivery_evidence=") &&
      source.nativePushProbe.includes(': "required"') &&
      source.nativePushProbe.includes('key: "ios_fcm_token_bridge"') &&
      source.rootPackageJson.includes('"qa:native-push": "node scripts/native-push-qa-probe.mjs"') &&
      source.rootPackageJson.includes('"qa:native-push:required": "node scripts/native-push-qa-probe.mjs --require-ready"') &&
      source.nativePrep.includes("Android release bundling fails closed") &&
      source.nativePrep.includes("npm.cmd run qa:native-push") &&
      source.nativePrep.includes("staging guard") &&
      source.nativePrep.includes("iOS FCM token bridge") &&
      source.readme.includes("Android native alert config stays private-build-only") &&
      source.readme.includes("Android release bundling fails closed") &&
      source.nativePrep.includes("Enable Firebase/FCM notification delivery only after") &&
      source.mobileRunbook.includes("Firebase project, native app config files") &&
      source.readiness.includes("UI, registration, and delivery gates off"),
    message: checkedInNativePushConfigFiles.length
      ? `Remove native push config from repo before public review: ${checkedInNativePushConfigFiles.join(", ")}`
      : undefined,
  },
  {
    label: "native Android target API stays explicit for internal testing or submission",
    ok:
      source.androidVariables.includes("compileSdkVersion") &&
      source.androidVariables.includes("targetSdkVersion") &&
      (androidSdkPair === "35 / 35" || androidApi36SubmissionReady) &&
      source.nativePrep.includes("August 31, 2026") &&
      source.nativePrep.includes("Android 16 / API 36") &&
      (androidApi36DocsReady || androidApi35InternalOnly),
  },
  {
    label: "native Android next upload uses a fresh Play version code",
    ok:
      androidApi36SubmissionReady &&
      androidVersionCode >= 3 &&
      androidVersionName === "1.0.2" &&
      source.readiness.includes("Google Play currently serves API 36 release `1.0.2 (3)` to the closed test") &&
      source.readiness.includes("any replacement must increment above version code `3`") &&
      source.realDeviceQa.includes("versionName` and `versionCode` checked into"),
  },
  {
    label: "native wrapper uses TTC app icon and splash assets",
    ok:
      fileSize(`${wrapperRoot}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`) > 10000 &&
      fileSize(`${wrapperRoot}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png`) > 20000 &&
      fileSize(`${wrapperRoot}/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`) > 100000 &&
      fileSize(`${wrapperRoot}/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`) > 1000000,
  },
  {
    label: "native wrapper handoff uses current Windows commands and asset wording",
    ok:
      source.readme.includes("npm.cmd install") &&
      source.readme.includes("npm.cmd run doctor") &&
      source.readme.includes("npm.cmd run sync") &&
      source.readme.includes("npm.cmd run verify:native-release") &&
      source.readme.includes("It should fail until the Android probe sees an authorized device") &&
      source.readme.includes("app-link association endpoints") &&
      source.readme.includes("Android-profile") &&
      source.readme.includes("iOS-profile") &&
      !source.readme.includes("Run `npm install`") &&
      !source.readme.includes("Run `npm run doctor`") &&
      !source.readme.includes("Run `npm run sync`") &&
      source.readme.includes("Confirm the mapped TTC icon/splash assets stay current") &&
      source.readiness.includes("Validate the existing beta wrapper") &&
      source.readiness.includes("rebuild signed Android upload bundles") &&
      source.readiness.includes("Confirm the mapped native icon/splash assets remain current") &&
      !source.readiness.includes("Create and validate the beta wrapper") &&
      !source.readiness.includes("once Android/iOS packaging starts"),
  },
  {
    label: "native iOS wrapper declares linked app-functionality device ID collection",
    ok:
      source.iosPrivacy.includes("NSPrivacyTracking") &&
      source.iosPrivacy.includes("<false/>") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypes") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypeDeviceID") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypeLinked") &&
      source.iosPrivacy.includes("<true/>") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypeTracking") &&
      source.iosPrivacy.includes("<key>NSPrivacyAccessedAPITypes</key>") &&
      source.iosProject.includes("PrivacyInfo.xcprivacy in Resources"),
  },
  {
    label: "native iOS signing team stays private to Xcode handoff",
    ok:
      !committedIosTeamId &&
      source.iosProject.includes('DEVELOPMENT_TEAM = "";') &&
      source.nativePrep.includes("no team IDs or provisioning details") &&
      source.readme.includes("without committing fingerprints, team identifiers"),
  },
  {
    label: "native privacy manifest is not used as store App Privacy source",
    ok:
      source.nativePrep.includes("covers only the thin native wrapper") &&
      source.nativePrep.includes("declares the app-owned installation and delivery token identifiers as Device ID") &&
      source.nativePrep.includes("linked to the member") &&
      source.nativePrep.includes("not used for tracking") &&
      source.nativePrep.includes("Do not use this narrow manifest as the App Store App Privacy answer source") &&
      source.nativePrep.includes("docs/DATA_SAFETY_PREP.md") &&
      source.dataSafetyPrep?.includes("App Store privacy nutrition labels") &&
      source.dataSafetyPrep?.includes("Xcode aggregate Privacy Report") &&
      source.dataSafetyPrep?.includes("Device ID as linked to the member") &&
      source.iosUploadChecklist.includes("Generate Xcode's aggregate Privacy Report") &&
      source.iosUploadChecklist.includes("Capacitor, Cordova, and native messaging dependencies"),
  },
  {
    label: "native iOS wrapper has App Store archive/export script",
    ok:
      source.iosBuildScript.includes("xcodebuild") &&
      source.iosBuildScript.includes("clean archive") &&
      source.iosBuildScript.includes("-exportArchive") &&
      source.iosBuildScript.includes("App.xcworkspace") &&
      source.iosBuildScript.includes('RELEASE_COMMIT="${TTC_IOS_RELEASE_COMMIT:-}"') &&
      source.iosBuildScript.includes('git -C "$REPO_ROOT" rev-parse HEAD') &&
      source.iosBuildScript.includes("git -C \"$REPO_ROOT\" diff --cached --quiet") &&
      source.iosBuildScript.includes("ls-files --others --exclude-standard") &&
      source.iosBuildScript.includes("pod install --deployment") &&
      source.iosBuildScript.includes("Locked dependency installation changed the reviewed source.") &&
      source.iosPodfileLock.includes("PODS:") &&
      source.iosPodfileLock.includes("CapacitorFirebaseMessaging (7.5.0)") &&
      source.iosPodfileLock.includes("COCOAPODS: 1.16.2") &&
      source.iosExportOptions.includes("app-store-connect") &&
      source.iosExportOptions.includes("signingStyle"),
  },
  {
    label: "native iOS wrapper documents TestFlight upload handoff",
    ok:
      source.iosUploadChecklist.includes("App.xcworkspace") &&
      source.iosUploadChecklist.includes("com.thetattoocore.app") &&
      source.iosUploadChecklist.includes("TestFlight internal testing") &&
      source.iosUploadChecklist.includes("https://thetattoocore.com/support") &&
      source.iosUploadChecklist.includes("Windows machine cannot run Xcode"),
  },
  {
    label: "native iOS upload handoff keeps App Store pre-submit gates explicit",
    ok:
      source.iosUploadChecklist.includes("App Privacy/Privacy Policy URL") &&
      source.iosUploadChecklist.includes("age rating") &&
      source.iosUploadChecklist.includes("Content Rights") &&
      source.iosUploadChecklist.includes("Accessibility Nutrition Labels") &&
      source.iosUploadChecklist.includes("Device ID as collected, linked to the member") &&
      source.iosUploadChecklist.includes("screenshot upload") &&
      source.iosUploadChecklist.includes("category/pricing") &&
      source.iosUploadChecklist.includes("final reviewer access for the selected build") &&
      source.iosUploadChecklist.includes("private release handoff"),
  },
  {
    label: "native iOS build handoff matches checked-in TestFlight version",
    ok:
      iosBuildVersionsMatch &&
      iosMarketingVersionsMatch &&
      source.iosUploadChecklist.includes(`Confirm version: \`${iosCurrentMarketingVersion}\``) &&
      source.iosUploadChecklist.includes("Confirm build matches the checked-in Xcode `CURRENT_PROJECT_VERSION`") &&
      source.iosUploadChecklist.includes("App Store Connect/TestFlight build selected for review") &&
      source.iosUploadChecklist.includes(`build \`${iosCurrentBuildVersion}\``) &&
      source.iosUploadChecklist.includes(`build \`${iosCurrentStoreBuild}\``) &&
      !source.iosUploadChecklist.includes("Confirm build: `1`"),
  },
  {
    label: "native iOS wrapper has a reviewed-commit Mac bootstrap",
    ok:
      source.iosBootstrapScript.includes("github.com/lobosdesigns/thetattoocore.git") &&
      source.iosBootstrapScript.includes("ttc-ios-build.log") &&
      source.iosBootstrapScript.includes('RELEASE_COMMIT="${TTC_IOS_RELEASE_COMMIT:-}"') &&
      source.iosBootstrapScript.includes("^[0-9a-f]{40}$") &&
      source.iosBootstrapScript.includes('git checkout --detach "$RELEASE_COMMIT"') &&
      source.iosBootstrapScript.includes('git rev-parse HEAD') &&
      source.iosBootstrapScript.includes("git diff --cached --quiet") &&
      source.iosBootstrapScript.includes("ls-files --others --exclude-standard") &&
      source.iosBootstrapScript.includes("Dependency installation or native sync changed the reviewed source.") &&
      source.iosBootstrapScript.includes("GoogleService-Info.plist") &&
      source.iosBootstrapScript.includes("npm ci") &&
      source.iosBootstrapScript.includes("npm run sync") &&
      source.iosBootstrapScript.includes("bash ./build-testflight.sh") &&
      !source.iosBootstrapScript.includes("git checkout main") &&
      !source.iosBootstrapScript.includes("git pull --ff-only origin main") &&
      !source.iosBootstrapScript.includes('rm -rf "$WORKDIR"') &&
      !source.iosBootstrapScript.includes("chmod +x build-testflight.sh") &&
      source.iosUploadChecklist.includes("TTC_IOS_RELEASE_COMMIT") &&
      source.iosUploadChecklist.includes("${TTC_IOS_RELEASE_COMMIT}") &&
      source.iosUploadChecklist.includes("exact commit in detached mode"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  failures.forEach((check) => {
    if (check.message) console.error(`  ${check.message}`);
  });
  console.error(`${failures.length} native wrapper smoke check(s) failed.`);
  process.exit(1);
}
