# TheTattooCore Mobile Beta Wrapper

This folder is the starting point for Apple TestFlight and Google Play internal testing.

## Position

- App ID: `com.thetattoocore.app`
- App name: `TheTattooCore`
- Start URL: `https://thetattoocore.com/login`
- Public support: `support@thetattoocore.com`
- Native permissions at first beta: none beyond the WebView defaults.
- Push prompts: off until native device-token delivery is built and tested.

## Build Notes

1. Run `npm install` in this folder.
2. Run `npm run doctor`.
3. Run `npm run sync`.
4. Build Android on a machine with Android SDK and JDK 21:
   - `cd android`
   - `.\gradlew.bat assembleDebug`
   - `.\gradlew.bat bundleRelease`
5. Build iOS on a Mac with Xcode:
   - `cd ios/App`
   - `pod install`
   - `open App.xcworkspace`
6. Reuse the approved TTC icon/splash assets from `../../public/icons` and `../../public/splash`.
7. Run the web smoke tests from the repo root before native packaging:
   - `npm.cmd run verify`
   - `npm.cmd run smoke:mobile`
8. Run `../../docs/REAL_DEVICE_QA_CHECKLIST.md` on real devices before wider beta invites.

Android packaging is configured on this Windows machine. A signed Google Play upload bundle builds at `android/app/build/outputs/bundle/release/app-release.aab` when the local signing environment variables are set. The upload keystore and recovery details are intentionally kept out of git; the local recovery note is saved on the Desktop as `TheTattooCore Android Upload Key.txt`. iOS packaging requires the Mac/Xcode path.

## Store Path

- Google Play: internal testing first.
- Apple: TestFlight internal testing first.
- Public release waits for final legal review, store screenshots, data-safety/privacy answers, and production payment policy review.
