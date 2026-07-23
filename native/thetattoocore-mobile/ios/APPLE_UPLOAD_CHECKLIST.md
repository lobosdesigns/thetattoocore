# Apple TestFlight Upload Checklist

Use this after signing in to MacinCloud and App Store Connect.

## 1. Move The Project To The Mac

Copy or pull the repo so this folder exists on the Mac:

`native/thetattoocore-mobile`

## 2. Install And Sync

From the Mac terminal:

```bash
cd native/thetattoocore-mobile
npm ci
npm run sync
```

Or run the one-command bootstrap from the Mac terminal after replacing the
placeholder with the full 40-character commit that passed the release checks:

```bash
export TTC_IOS_RELEASE_COMMIT="<full-reviewed-commit>"
curl -fsSL "https://raw.githubusercontent.com/lobosdesigns/thetattoocore/${TTC_IOS_RELEASE_COMMIT}/native/thetattoocore-mobile/ios/mac-bootstrap-testflight.sh" | bash
```

The bootstrap writes logs to `~/Desktop/ttc-ios-build.log`, checks out that
exact commit in detached mode, and stops instead of switching source when the
existing checkout is dirty or points at a different repository. It also stops
before dependency installation when the ignored private iOS app configuration
is missing. The archive uses the checked-in `Podfile.lock` in deployment mode
so reviewed native dependency versions cannot drift during packaging.

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
- The native smoke guard derives the checked-in Xcode version/build and verifies this handoff stays aligned with the current TestFlight status line.
- Confirm the next internal TestFlight candidate is build `4`, shown as TestFlight build `1.0 (4)`, and do not replace build `3` on the App Store version already in review.
- Confirm `GoogleService-Info.plist` belongs to the `App` target, Push Notifications is enabled, and the signed archive resolves `aps-environment` to `production`.
- Keep messaging auto-initialization and production delivery off until explicit member opt-in, token registration, notification delivery, tap routing, and opt-out pass on build `4`.
- Generate Xcode's aggregate Privacy Report from the next archive. Confirm the TTC app manifest declares Device ID as collected, linked to the member, used for app functionality, and not used for tracking, and confirm valid manifests are present for Capacitor, Cordova, and native messaging dependencies. Keep the report private.
- Confirm login, signup, forgot password, reset password, and email confirmation stay inside the app WebView during the device smoke pass.
- Capture exact-build minimum-functionality proof for app-specific 4U
  navigation, retained installed sessions, native back/home behavior,
  App/Universal Links, correct system-bar framing, and native notification
  opt-in/tap routing where enabled.

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
- Before public App Review submission, confirm App Privacy/Privacy Policy URL,
  age rating, Content Rights, screenshot upload validation, category/pricing,
  and final reviewer access for the selected build are complete in App Store
  Connect. Accessibility Nutrition Labels are voluntary; leave them unclaimed
  unless exact-build iPhone/iPad QA supports an honest claim. Keep reviewer
  credentials, phone details, account identifiers, and console screenshots in
  the private release handoff only.
- Confirm App Privacy includes Device ID as collected, linked to the member,
  used for app functionality, and not used for tracking, alongside the broader
  TTC web/app disclosures in `docs/DATA_SAFETY_PREP.md`.

## Current Status

This Windows machine cannot run Xcode, CocoaPods, or Apple upload tooling. The upload must happen on the Mac after Apple/MacinCloud sign-in and any 2FA prompts are complete.

On July 18, 2026, Xcode Organizer uploaded iOS version `1.0`, build `3`, to App Store Connect. App Store Connect shows build `1.0 (3)` as attached to the TTC Internal Testers group and available for internal TestFlight testing. Checked-in build `4` is the isolated notification-capability candidate for internal TestFlight; it must not replace build `3` on the App Store version already in review.
