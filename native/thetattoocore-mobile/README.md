# TheTattooCore Mobile Beta Wrapper

This folder supports Apple TestFlight/App Review plus Google Play Production and controlled Alpha testing.

## Current Build Evidence Boundary - August 2, 2026

- Checked-in Android source candidate: `1.0.5 (6)`.
- Checked-in iOS source candidate: `1.0 (5)`.
- Repository source identity is not signed-artifact, upload, console-selection, served-track, or installed-device proof.
- Exact current App Review identity: **UNKNOWN**.
- Exact current TestFlight identity: **UNKNOWN**.
- Exact current Google Play Production identity: **UNKNOWN**.
- Exact current Google Play Closed testing - Alpha identity: **UNKNOWN**.
- Exact current installed Android identity: **UNKNOWN**.
- Exact current installed iOS identity: **UNKNOWN**.
- A separately authorized read-only signed-in console/device verification is required before QA or release claims. Do not upload, select, submit, promote, install, or change an artifact during that verification.

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
   package build matches the separately verified Google Play track and installed identities selected for the QA pass.
   - The probe starts the local ADB server before listing devices and prints
     `ANDROID_QA adb_server=started` or `ANDROID_QA adb_server=start failed` as
     a repo-safe setup status.
   - The required release gate waits briefly for USB/debug authorization before
     failing, so leave the phone unlocked while it runs.
   - If the probe reports `devices_total=0`, check the USB cable, set USB mode
     to file transfer, and reopen the USB debugging prompt.
   - If the probe reports an unauthorized or offline device, unlock the device,
     enable USB debugging, and accept the computer authorization prompt.
   - If the probe reports `authorized device missing TTC package`, stop and
     verify the intended track and installed identities before route QA.
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

Android packaging is configured on this Windows machine. A signed Google Play upload bundle builds at `android/app/build/outputs/bundle/release/app-release.aab` only when the private signing environment is present. Android 16 / API 36 tooling is installed, and checked-in Android source candidate `1.0.5 (6)` targets `36 / 36`. That source identity does not prove signing, upload, Production or Alpha selection, served state, or installation. iOS packaging requires the Mac/Xcode path.

### Historical Android Packaging Baseline - July 18-24, 2026 (Non-Operative)

Earlier private evidence recorded signed Android bundles, Google Play Production `1.0.3 (4)`, Alpha `1.0.4 (5)`, and authorized-phone installs during their dated QA passes. Preserve bundle hashes, signing lineage, tester details, and device evidence only in the private handoff. These dated facts do not establish any current served, selected, or installed identity and cannot authorize a build or release action.

## Android Release Target Handoff

| Release path | Current compile/target SDK | Status |
| --- | ---: | --- |
| Current Play Production release | **UNKNOWN** | Read-only verify the exact track identity before QA or any release decision. |
| Current controlled Alpha release | **UNKNOWN** | Read-only verify the exact track identity and tester availability before QA. |
| Current installed Android build | **UNKNOWN** | Verify independently on the authorized device; source and console identity are not install proof. |
| Checked-in Android source candidate | `36 / 36`; `6` / `1.0.5` | Source identity only. Do not call it signed, uploaded, selected, served, or installed without separate evidence. |

## Store Path

- Google Play: decide the QA/install path only after read-only verification records the exact current Production and Alpha identities. Keep tester participation/duration evidence private.
- Apple: TestFlight/App Review handoff first, with status changes and reviewer messages archived privately.
- Future replacement releases wait for final legal review, store screenshots, data-safety/privacy answers, and production payment policy review.
- Android App Links are published for the final Play signing certificate; iOS
  Universal Links still wait on the final team/app association and signed
  associated-domain build.
- Verified app-link evidence should follow `../../docs/NATIVE_WRAPPER_PREP.md` and stay private: publish the Android and Apple association files only after final signing/team details are confirmed, then record real-device route proof without committing fingerprints, team identifiers, provisioning details, console screenshots, tester accounts, or raw device logs.
