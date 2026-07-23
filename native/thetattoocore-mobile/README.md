# TheTattooCore Mobile Beta Wrapper

This folder is the starting point for Apple TestFlight and Google Play closed/internal testing.

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
   package build matches the current Play closed-testing release.
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
     confirm the Google Play closed-testing build before route QA.
   - If the probe reports `authorized device has wrong TTC build`, install the
     active Google Play closed-test build with
     `npm.cmd run qa:android-device:open-test`, or set
     `TTC_ANDROID_EXPECTED_VERSION_NAME` and
     `TTC_ANDROID_EXPECTED_VERSION_CODE` for the selected track before rerunning
     the probe.
   - Run `npm.cmd run qa:android-device:open-link` after the public association
     file is configured. The required probe confirms both TTC domains are
     verified and enabled before requesting the safe `/messages` route.
   - On Android 15 or newer, confirm the TTC header and controls stay below the
     clock/status area and the bottom navigation stays above the device's
     gesture or three-button navigation area.

Android packaging is configured on this Windows machine. A signed Google Play upload bundle builds at `android/app/build/outputs/bundle/release/app-release.aab` when the local signing environment variables are set. On July 18, 2026, the signed v1 bundle was verified and copied to the Desktop as `TheTattooCore-app-release-v1-signed.aab` with SHA-256 `18E16D3CB5AEED158C33BF9882AC6920D6A7CB744697568E71C32631BC893B65`. The upload keystore and recovery details are intentionally kept out of git; the local recovery note is saved on the Desktop as `TheTattooCore Android Upload Key.txt`. iOS packaging requires the Mac/Xcode path.
Android 16 / API 36 tooling is installed on this Windows machine, and the checked-in candidate targets `36 / 36`. Closed testing - Alpha is active with version code `3` / version name `1.0.2`, released to the existing Google Group on July 22, 2026. The authorized Android 16 review phone joined the test, installed exact build `1.0.2 (3)`, passed the required package/target probe, and cold-launched into its retained 4U session without system-bar overlap. Notification permission remained ungranted until explicit member opt-in, as required. The signed API 36 Alpha bundle is saved on the Desktop as `TheTattooCore-app-release-v3-1.0.2-api36-signed.aab` with SHA-256 `983E08A6341B80E8A24A2D9957C4A601787CB9574AA137AA0D925256F1D2315B`. Candidate `1.0.3 (4)` adds the dedicated monochrome TTC notification status icon and is not active or device-verified until Google Play serves it. Any later replacement must increment above version code `4`, then rerun wrapper and real-device QA before selecting another Google Play submission/update track.

## Android Release Target Handoff

| Release path | Current compile/target SDK | Status |
| --- | ---: | --- |
| Current Play closed-test release | `36 / 36`; active `3` / `1.0.2` | Exact-build install, target SDK 36, retained-session cold launch, system-bar framing, and permission-off baseline passed on the authorized Android 16 phone. |
| Staged Play candidate | `36 / 36`; candidate `4` / `1.0.3` | Requires a fresh signed bundle, Google Play installation, and exact-build real-device QA before it replaces the active baseline. |
| Later replacement or update | `36 / 36`; next version code above `4` | Requires a fresh signed rebuild plus real-device QA evidence before track selection. |

## Store Path

- Google Play: closed/internal testing first, with the current API 36 closed-test release and tester participation/duration evidence validated before wider release.
- Apple: TestFlight/App Review handoff first, with status changes and reviewer messages archived privately.
- Public release waits for final legal review, store screenshots, data-safety/privacy answers, and production payment policy review.
- Android App Links are published for the final Play signing certificate; iOS
  Universal Links still wait on the final team/app association and signed
  associated-domain build.
- Verified app-link evidence should follow `../../docs/NATIVE_WRAPPER_PREP.md` and stay private: publish the Android and Apple association files only after final signing/team details are confirmed, then record real-device route proof without committing fingerprints, team identifiers, provisioning details, console screenshots, tester accounts, or raw device logs.
