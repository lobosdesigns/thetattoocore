import { existsSync, readFileSync, statSync } from "node:fs";

const wrapperRoot = "native/thetattoocore-mobile";
const files = {
  androidManifest: `${wrapperRoot}/android/app/src/main/AndroidManifest.xml`,
  androidVariables: `${wrapperRoot}/android/variables.gradle`,
  capacitorConfig: `${wrapperRoot}/capacitor.config.ts`,
  iosBuildScript: `${wrapperRoot}/ios/build-testflight.sh`,
  iosBootstrapScript: `${wrapperRoot}/ios/mac-bootstrap-testflight.sh`,
  iosExportOptions: `${wrapperRoot}/ios/ExportOptions-AppStore.template.plist`,
  iosInfo: `${wrapperRoot}/ios/App/App/Info.plist`,
  iosPrivacy: `${wrapperRoot}/ios/App/App/PrivacyInfo.xcprivacy`,
  iosEntitlements: `${wrapperRoot}/ios/App/App/App.entitlements`,
  iosProject: `${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`,
  iosUploadChecklist: `${wrapperRoot}/ios/APPLE_UPLOAD_CHECKLIST.md`,
  dataSafetyPrep: "docs/DATA_SAFETY_PREP.md",
  mobileRunbook: "docs/MOBILE_APP_SUBMISSION_RUNBOOK.md",
  nativePrep: "docs/NATIVE_WRAPPER_PREP.md",
  readiness: "docs/APP_STORE_READINESS.md",
  packageJson: `${wrapperRoot}/package.json`,
  readme: `${wrapperRoot}/README.md`,
  webFallback: `${wrapperRoot}/www/index.html`,
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [
    key,
    existsSync(path) ? readFileSync(path, "utf8") : "",
  ]),
);

const fileSize = (path) => (existsSync(path) ? statSync(path).size : 0);

const nativeSourceForLeakChecks = Object.entries(source)
  .filter(([key]) => key !== "nativePrep" && key !== "mobileRunbook")
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

function gradleNumber(name) {
  const match = source.androidVariables.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));

  return match ? Number.parseInt(match[1], 10) : NaN;
}

const compileSdkVersion = gradleNumber("compileSdkVersion");
const targetSdkVersion = gradleNumber("targetSdkVersion");
const androidApi36SubmissionReady = compileSdkVersion >= 36 && targetSdkVersion >= 36;
const androidApi35InternalOnly =
  compileSdkVersion === 35 &&
  targetSdkVersion === 35 &&
  source.nativePrep.includes("API 35 is internal-test-only") &&
  source.nativePrep.includes("not public-submission-ready") &&
  source.mobileRunbook.includes("API 35 is internal-test-only") &&
  source.readme.includes("API 35 is internal-test-only");

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
    label: "native wrapper avoids provider, secret, and environment-token leakage",
    ok: forbiddenNativeTokens.every((token) => !nativeSourceForLeakChecks.includes(token)),
  },
  {
    label: "native wrapper keeps TestFlight auth navigation inside the app",
    ok:
      source.capacitorConfig.includes('allowNavigation: ["thetattoocore.com", "www.thetattoocore.com"]') &&
      source.nativePrep.includes("Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView") &&
      source.mobileRunbook.includes("Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView") &&
      source.iosUploadChecklist.includes("Confirm login, signup, forgot password, reset password, and email confirmation stay inside the app WebView"),
  },
  {
    label: "native wrapper declares TTC shared-link routing with iOS links deferred until profile support",
    ok:
      source.androidManifest.includes('android.intent.action.VIEW') &&
      source.androidManifest.includes('android.intent.category.BROWSABLE') &&
      source.androidManifest.includes('android:host="thetattoocore.com"') &&
      source.androidManifest.includes('android:host="www.thetattoocore.com"') &&
      source.nativePrep.includes("Deep-link wiring is started in the wrapper") &&
      source.nativePrep.includes("iOS universal links are deferred for the first TestFlight build") &&
      source.mobileRunbook.includes("Confirm public shared links open in the wrapper"),
  },
  {
    label: "native wrapper keeps verified app-link evidence private and route-complete",
    ok:
      source.nativePrep.includes("## Verified Link Evidence Matrix") &&
      source.nativePrep.includes("| Platform | Association file | Native entitlement or manifest proof | Device proof | Repo-safe result |") &&
      source.nativePrep.includes("`/.well-known/assetlinks.json`") &&
      source.nativePrep.includes("Google Play app-signing certificate fingerprint") &&
      source.nativePrep.includes("`/.well-known/apple-app-site-association`") &&
      source.nativePrep.includes("Associated Domains capability") &&
      source.nativePrep.includes("profile, post, Gossip, Stuff, Gigs, Merch, booking, Support, Privacy, and Terms links") &&
      source.nativePrep.includes("Do not treat URL scheme handling, simulator-only checks, browser-sized mobile QA") &&
      source.nativePrep.includes("Do not commit signing") &&
      source.mobileRunbook.includes("Verified app-link and universal-link proof should use the matrix") &&
      source.readme.includes("Verified app-link evidence should follow") &&
      source.readme.includes("without committing fingerprints, team identifiers, provisioning details, console screenshots, tester accounts, or raw device logs"),
  },
  {
    label: "native wrapper keeps launch permissions minimal",
    ok:
      source.androidManifest.includes("android.permission.INTERNET") &&
      !source.androidManifest.includes("android.permission.POST_NOTIFICATIONS") &&
      !source.androidManifest.includes("android.permission.CAMERA") &&
      !source.androidManifest.includes("android.permission.RECORD_AUDIO") &&
      !source.androidManifest.includes("android.permission.ACCESS_FINE_LOCATION") &&
      !source.androidManifest.includes("android.permission.READ_CONTACTS") &&
      !source.iosEntitlements.includes("aps-environment") &&
      !source.iosProject.includes("Push Notifications") &&
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
    label: "native wrapper notes keep TestFlight and Play internal first",
    ok:
      source.readme.includes("Apple TestFlight") &&
      source.readme.includes("Google Play internal testing") &&
      source.readme.includes("Public release waits for final legal review") &&
      source.nativePrep.includes("August 31, 2026") &&
      source.nativePrep.includes("Android 16 / API 36") &&
      source.mobileRunbook.includes("current internal-test Android build targets API 35") &&
      source.readme.includes("support@thetattoocore.com") &&
      source.readme.includes("Native permissions at first beta: none") &&
      source.readme.includes("Push prompts: off") &&
      source.mobileRunbook.includes("Firebase Cloud Messaging") &&
      source.mobileRunbook.includes("Do not request native notification permission"),
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
      source.mobileRunbook.includes("Firebase project, native app config files") &&
      source.mobileRunbook.includes("Android and iOS device-token registration") &&
      source.mobileRunbook.includes("alert delivery, notification tap routing, opt-out"),
  },
  {
    label: "native Android target API stays explicit for internal testing or submission",
    ok:
      source.androidVariables.includes("compileSdkVersion") &&
      source.androidVariables.includes("targetSdkVersion") &&
      source.nativePrep.includes("August 31, 2026") &&
      source.nativePrep.includes("Android 16 / API 36") &&
      (androidApi36SubmissionReady || androidApi35InternalOnly),
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
    label: "native iOS wrapper includes privacy manifest resource",
    ok:
      source.iosPrivacy.includes("NSPrivacyTracking") &&
      source.iosPrivacy.includes("<false/>") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypes") &&
      source.iosProject.includes("PrivacyInfo.xcprivacy in Resources"),
  },
  {
    label: "native privacy manifest is not used as store App Privacy source",
    ok:
      source.nativePrep.includes("covers only the thin native wrapper") &&
      source.nativePrep.includes("Do not use its empty data arrays as the App Store App Privacy answer source") &&
      source.nativePrep.includes("docs/DATA_SAFETY_PREP.md") &&
      source.dataSafetyPrep?.includes("App Store privacy nutrition labels"),
  },
  {
    label: "native iOS wrapper has App Store archive/export script",
    ok:
      source.iosBuildScript.includes("xcodebuild") &&
      source.iosBuildScript.includes("clean archive") &&
      source.iosBuildScript.includes("-exportArchive") &&
      source.iosBuildScript.includes("App.xcworkspace") &&
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
    label: "native iOS wrapper has one-command Mac bootstrap",
    ok:
      source.iosBootstrapScript.includes("github.com/lobosdesigns/thetattoocore.git") &&
      source.iosBootstrapScript.includes("ttc-ios-build.log") &&
      source.iosBootstrapScript.includes("npm run sync") &&
      source.iosBootstrapScript.includes("./build-testflight.sh") &&
      source.iosUploadChecklist.includes("mac-bootstrap-testflight.sh"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} native wrapper smoke check(s) failed.`);
  process.exit(1);
}
