import { existsSync, readFileSync, statSync } from "node:fs";

const wrapperRoot = "native/thetattoocore-mobile";
const files = {
  androidManifest: `${wrapperRoot}/android/app/src/main/AndroidManifest.xml`,
  capacitorConfig: `${wrapperRoot}/capacitor.config.ts`,
  iosBuildScript: `${wrapperRoot}/ios/build-testflight.sh`,
  iosBootstrapScript: `${wrapperRoot}/ios/mac-bootstrap-testflight.sh`,
  iosExportOptions: `${wrapperRoot}/ios/ExportOptions-AppStore.template.plist`,
  iosInfo: `${wrapperRoot}/ios/App/App/Info.plist`,
  iosPrivacy: `${wrapperRoot}/ios/App/App/PrivacyInfo.xcprivacy`,
  iosProject: `${wrapperRoot}/ios/App/App.xcodeproj/project.pbxproj`,
  iosUploadChecklist: `${wrapperRoot}/ios/APPLE_UPLOAD_CHECKLIST.md`,
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
      !source.capacitorConfig.includes("bundledWebRuntime") &&
      source.webFallback.includes("https://thetattoocore.com/login"),
  },
  {
    label: "native wrapper keeps launch permissions minimal",
    ok:
      source.androidManifest.includes("android.permission.INTERNET") &&
      !source.androidManifest.includes("android.permission.CAMERA") &&
      !source.androidManifest.includes("android.permission.RECORD_AUDIO") &&
      !source.androidManifest.includes("android.permission.ACCESS_FINE_LOCATION") &&
      !source.androidManifest.includes("android.permission.READ_CONTACTS") &&
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
      !source.iosInfo.includes("UIInterfaceOrientationLandscapeLeft") &&
      !source.iosInfo.includes("UIInterfaceOrientationLandscapeRight") &&
      source.iosInfo.includes("ITSAppUsesNonExemptEncryption") &&
      source.capacitorConfig.includes("cleartext: false"),
  },
  {
    label: "native wrapper notes keep TestFlight and Play internal first",
    ok:
      source.readme.includes("Apple TestFlight") &&
      source.readme.includes("Google Play internal testing") &&
      source.readme.includes("Public release waits for final legal review") &&
      source.readme.includes("support@thetattoocore.com") &&
      source.readme.includes("Native permissions at first beta: none"),
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
    label: "native iOS wrapper includes privacy manifest resource",
    ok:
      source.iosPrivacy.includes("NSPrivacyTracking") &&
      source.iosPrivacy.includes("<false/>") &&
      source.iosPrivacy.includes("NSPrivacyCollectedDataTypes") &&
      source.iosProject.includes("PrivacyInfo.xcprivacy in Resources"),
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
