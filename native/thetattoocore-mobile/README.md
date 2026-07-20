# TheTattooCore Mobile Beta Wrapper

This folder is the starting point for Apple TestFlight and Google Play internal testing.

## Position

- App ID: `com.thetattoocore.app`
- App name: `TheTattooCore`
- Start URL: `https://thetattoocore.com/login`
- Public support: `support@thetattoocore.com`
- Native permissions at first beta: none beyond the WebView defaults.
- Push prompts: off until native device-token delivery is built and tested.
- TTC web links are declared for the wrapper; final verified app links still require the signed Android fingerprint and Apple site-association file before public release.

## Build Notes

1. On Windows/Android prep, run `npm.cmd install` in this folder.
2. Run `npm.cmd run doctor`.
3. Run `npm.cmd run sync`.
4. Build Android on a machine with Android SDK and JDK 21:
   - `cd android`
   - `.\gradlew.bat assembleDebug`
   - `.\gradlew.bat bundleRelease`
5. Build iOS on a Mac with Xcode:
   - `cd ios/App`
   - `pod install`
   - `open App.xcworkspace`
6. Confirm the mapped TTC icon/splash assets stay current with `../../public/icons` and `../../public/splash`.
7. Run the web smoke tests from the repo root before native packaging:
   - `npm.cmd run verify`
   - `npm.cmd run smoke:mobile`
8. Run `../../docs/REAL_DEVICE_QA_CHECKLIST.md` on real devices before wider beta invites.

Android packaging is configured on this Windows machine. A signed Google Play upload bundle builds at `android/app/build/outputs/bundle/release/app-release.aab` when the local signing environment variables are set. On July 18, 2026, the signed v1 bundle was verified and copied to the Desktop as `TheTattooCore-app-release-v1-signed.aab` with SHA-256 `18E16D3CB5AEED158C33BF9882AC6920D6A7CB744697568E71C32631BC893B65`. The upload keystore and recovery details are intentionally kept out of git; the local recovery note is saved on the Desktop as `TheTattooCore Android Upload Key.txt`. iOS packaging requires the Mac/Xcode path.
The current Android wrapper uses API 35 because this Windows machine only has Android 35 installed. API 35 is internal-test-only and not public-submission-ready for Google Play submissions or updates on or after August 31, 2026; install Android 16 / API 36 tooling, set `compileSdkVersion` and `targetSdkVersion` to 36, and rebuild before that submission path.

## Store Path

- Google Play: internal testing first.
- Apple: TestFlight internal testing first.
- Public release waits for final legal review, store screenshots, data-safety/privacy answers, and production payment policy review.
- Verified app links/universal links wait on final signing details and domain association files.
