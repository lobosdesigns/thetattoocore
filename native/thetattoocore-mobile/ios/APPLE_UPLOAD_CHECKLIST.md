# Apple TestFlight Upload Checklist

Use this after signing in to MacinCloud and App Store Connect.

## 1. Move The Project To The Mac

Copy or pull the repo so this folder exists on the Mac:

`native/thetattoocore-mobile`

## 2. Install And Sync

From the Mac terminal:

```bash
cd native/thetattoocore-mobile
npm install
npm run sync
```

Or run the one-command bootstrap from the Mac terminal:

```bash
curl -L https://raw.githubusercontent.com/lobosdesigns/thetattoocore/main/native/thetattoocore-mobile/ios/mac-bootstrap-testflight.sh | bash
```

The bootstrap writes logs to `~/Desktop/ttc-ios-build.log`.

## 3. Open Xcode

```bash
cd ios/App
pod install
open App.xcworkspace
```

In Xcode:

- Select the `App` project.
- Select the `App` target.
- Signing & Capabilities: choose the Apple developer team.
- Confirm bundle identifier: `com.thetattoocore.app`.
- Confirm display name: `TheTattooCore`.
- Confirm version: `1.0`.
- Confirm build matches the checked-in Xcode `CURRENT_PROJECT_VERSION` and the App Store Connect/TestFlight build selected for review.
- Confirm login, signup, forgot password, reset password, and email confirmation stay inside the app WebView during the device smoke pass.

## 4. Archive

In Xcode:

- Select a generic iOS device destination.
- Product > Archive.
- When Organizer opens, validate the archive.
- Distribute App > App Store Connect > Upload.

## 5. App Store Connect

After upload processing:

- Add the build to TestFlight internal testing first.
- Use the metadata in `native/store-metadata/apple-app-store/en-US`.
- Use support URL `https://thetattoocore.com/support`.
- Use privacy URL `https://thetattoocore.com/privacy`.
- Do not submit for public App Review until the real-device QA checklist and final legal/payment review are complete.

## Current Status

This Windows machine cannot run Xcode, CocoaPods, or Apple upload tooling. The upload must happen on the Mac after Apple/MacinCloud sign-in and any 2FA prompts are complete.

On July 18, 2026, Xcode Organizer uploaded iOS version `1.0`, build `3`, to App Store Connect. App Store Connect shows build `1.0 (3)` as attached to the TTC Internal Testers group and available for internal TestFlight testing.
