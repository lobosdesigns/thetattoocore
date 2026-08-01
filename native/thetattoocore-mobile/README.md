# TheTattooCore Mobile Beta Wrapper

This folder supports Apple TestFlight/App Review plus Google Play Production and controlled Alpha testing.

## Position

- App ID: `com.thetattoocore.app`
- App name: `TheTattooCore`
- Start URL: `https://thetattoocore.com/login`
- Public support: `support@thetattoocore.com`
- Native permissions at first beta: none beyond the WebView defaults.
- Push prompts: off until native device-token delivery is built and tested.
- Android uses automatic Android system-bar inset margins so the WebView stays
  clear of the status bar, display cutout, and navigation area on current
  edge-to-edge devices.
- Android debug builds use a side-by-side QA package and label, preserving the
  installed Play testing app and its data during connected-device checks.
- Android native alert config stays private-build-only: the wrapper may know
  how to apply the Google services plugin, but the app config file stays out of
  git and is added only for a private build after device evidence is ready.
- Android release bundling fails closed when private upload signing or the
  ignored Android app configuration is missing or unreadable. Debug packaging
  remains available without release signing or a separate `.qa` app
  registration.
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
8. Before final native release handoff, run the stricter release gate from the
   repo root:
   - `npm.cmd run verify:native-predevice`
   - `npm.cmd run verify:native-release`
   - `npm.cmd run qa:native-push`
   Use the pre-device command to check environment boundaries, private native
   config exclusions, app-link association endpoints, readiness docs, store
   metadata, Android-profile mobile routes, and iOS-profile mobile routes before
   the review phone is authorized. The release command checks the same starting
   gates first.
   The native-push probe reports staged and pending prerequisites without
   printing private app configuration, signing data, or device tokens. Its
   `qa:native-push:required` form remains a fail-closed activation gate until
   both native platforms and the opt-in client flow are ready.
   It should fail until the Android probe sees an authorized device with the TTC
   package installed, then continue through store, Android-profile mobile, and
   iOS-profile mobile smoke checks.
9. Run `../../docs/REAL_DEVICE_QA_CHECKLIST.md` on real devices before wider beta invites.
10. On Windows, use the checklist's Android connected-device probe with
   `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`; a plugged-in phone only
   counts after `adb devices -l` shows an authorized device and the installed
   package build matches the current Google Play Production release.
   - The probe starts the local ADB server before listing devices and prints
     `ANDROID_QA adb_server=started` or `ANDROID_QA adb_server=start failed` as
     a repo-safe setup status.
   - The required release gate waits briefly for USB/debug authorization before
     failing, so leave the phone unlocked while it runs.
   - If the probe reports `devices_total=0`, check the USB cable, set USB mode
     to file transfer, and reopen the USB debugging prompt.
   - If the probe reports an unauthorized or offline device, unlock the device,
     enable USB debugging, and accept the computer authorization prompt.
   - If the probe reports `authorized device missing TTC package`, install or
     confirm the Google Play Production build before route QA.
   - If the probe reports `authorized device has wrong TTC build`, install the
     exact Google Play Production build and rerun the probe. Alpha is needed
     only for controlled-QA evidence; in that case use
     `npm.cmd run qa:android-device:open-test`, then set
     `TTC_ANDROID_EXPECTED_VERSION_NAME` and
     `TTC_ANDROID_EXPECTED_VERSION_CODE` only when the selected Alpha build
     intentionally differs.
   - Run `npm.cmd run qa:android-device:open-link` after the public association
     file is configured. The required probe confirms both TTC domains are
     verified and enabled before requesting the safe `/messages` route.
   - On Android 15 or newer, confirm the TTC header and controls stay below the
     clock/status area and the bottom navigation stays above the device's
     gesture or three-button navigation area.

Android packaging is configured on this Windows machine. A signed Google Play upload bundle builds at `android/app/build/outputs/bundle/release/app-release.aab` when the local signing environment variables are set. On July 18, 2026, the signed v1 bundle was verified and copied to the Desktop as `TheTattooCore-app-release-v1-signed.aab` with SHA-256 `18E16D3CB5AEED158C33BF9882AC6920D6A7CB744697568E71C32631BC893B65`. The upload keystore and recovery details are intentionally kept out of git; the local recovery note is saved on the Desktop as `TheTattooCore Android Upload Key.txt`. iOS packaging requires the Mac/Xcode path.
Android 16 / API 36 tooling is installed on this Windows machine, and the checked-in release targets `36 / 36`. Google Play Production serves version code `4` / version name `1.0.3`, while Closed testing - Alpha serves version code `5` / version name `1.0.4`; Production is the normal install and release-evidence path, while Alpha remains available to the existing tester community for controlled QA. The authorized Android 16 review phone installed both builds from Google Play during their respective QA passes. Build 5's signed API 36 bundle is saved on the Desktop as `TheTattooCore-app-release-v5-1.0.4-api36-signed.aab` with SHA-256 `4E9B63723C5846AA5F26EE58C71895EA1E428966379FDF7A578A541B96B6FA2F`; its signature and upload certificate match the accepted build 4 lineage. The checked-in replacement candidate is `1.0.5 (6)` and must be freshly signed, selected in Alpha, and installed from Google Play before its notification behavior is release evidence.

## Android Release Target Handoff

| Release path | Current compile/target SDK | Status |
| --- | ---: | --- |
| Current Play Production release | `36 / 36`; active `4` / `1.0.3` | Exact Production install, target SDK 36, verified App Links, production-link launch, retained-session landing, and system-bar framing passed on the authorized Android 16 phone. |
| Controlled Alpha release | `36 / 36`; active `5` / `1.0.4` | Previous candidate remains available to the tester community until exact build 6 replaces it; keep participation and tester evidence private. |
| Previous Play baseline | `36 / 36`; historical `3` / `1.0.2` | Preserve completed historical evidence, but do not include it in the active alert allowlist. |
| Checked-in replacement candidate | `36 / 36`; `6` / `1.0.5` | Requires a fresh signed rebuild plus real-device QA evidence before Alpha track selection; do not disturb public build 4. |

## Store Path

- Google Play: Production is the normal install and release-evidence path; use Closed testing - Alpha only for controlled QA and keep tester participation/duration evidence private.
- Apple: TestFlight/App Review handoff first, with status changes and reviewer messages archived privately.
- Future replacement releases wait for final legal review, store screenshots, data-safety/privacy answers, and production payment policy review.
- Android App Links are published for the final Play signing certificate; iOS
  Universal Links still wait on the final team/app association and signed
  associated-domain build.
- Verified app-link evidence should follow `../../docs/NATIVE_WRAPPER_PREP.md` and stay private: publish the Android and Apple association files only after final signing/team details are confirmed, then record real-device route proof without committing fingerprints, team identifiers, provisioning details, console screenshots, tester accounts, or raw device logs.
