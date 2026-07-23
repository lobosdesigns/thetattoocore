# Native Wrapper Prep

Use this before creating Android or iOS wrapper projects. The goal is a thin, policy-safe app shell around the production web app, not a separate native product with duplicated business logic.

## App Shell Position

- Start URL: `https://thetattoocore.com/login`.
- Keep shared links, support, Child Safety Standards, privacy, terms, account deletion, and public content previews on `thetattoocore.com`.
- Keep server-side auth, moderation, payments, mail, storage, verification, and admin workflows on the web app.
- Do not place private API keys, service-role keys, payment secrets, mail credentials, admin credentials, or database credentials in native code.
- Do not add broad native permissions just because the app is wrapped. Add permissions only when a tested feature requires them.

## Allowed Navigation

- Allow `https://thetattoocore.com` and same-origin app routes.
- Allow checkout only through the current review-controlled checkout flow, then return to safe internal app routes.
- Allow support, Child Safety Standards, privacy, terms, account deletion instructions, and public shared content routes.
- Block or open externally any unexpected third-party destinations.
- Keep all login return paths internal and reject protocol-relative or external return paths.

## Native Permissions

- Camera: do not request at wrapper launch unless a native camera bridge is deliberately added.
- Photo library / media picker: prefer normal browser file inputs first.
- Location: do not request precise device location at launch; typed city/region/country remains the default.
- Push notifications: do not prompt on first open. Ask only after notification preferences and device-token delivery are ready.
- Microphone: do not request at launch.
- Contacts: do not request at launch.

## Native Push Plan

- Use Firebase Cloud Messaging as the Android and iOS delivery path for native app alerts.
- Keep one Capacitor messaging bridge for both platforms. Do not install a second native push plugin beside it on iOS.
- Add the Android app config file to the wrapper only after the Firebase project is created for TheTattooCore and the package name `com.thetattoocore.app` is registered.
- The Android google-services plugin stays conditional: it may be declared in
  the Gradle classpath, but it should apply only when `google-services.json`
  exists in the private build environment.
- Add the iOS app config file only after the Apple bundle identifier, team, signing profile, and notification capability are confirmed on the Mac/Xcode build path.
- Keep push prompts off until device-token registration, per-device opt-out, quiet hours, and notification-category preferences are connected to the signed-in account.
- Keep the native setup UI and server registration write gates off by default. Activate them together only for controlled device QA after private app configuration is installed.
- Archive real-device evidence for Android and iOS notification permission prompts, token registration, alert delivery, notification tap routing, and opt-out before claiming native push support in store copy.

## Native Push Private Evidence Matrix

Use this matrix while setting up Firebase/FCM so native alerts can move from
planned to tested without committing app config files, sender identifiers,
console screenshots, device tokens, signing details, or tester account data.

| Step | Private evidence to capture | Repo-safe result |
| --- | --- | --- |
| Firebase project | Project exists for TheTattooCore with Android and iOS apps registered for `com.thetattoocore.app`. | `pending`, `created`, or `needs retry`; no project IDs, sender IDs, API keys, or console screenshots. |
| Android app config | Android app config file added only to the private build environment and excluded from git. | Record package name, release track, build version, and pass/fail only. |
| iOS app config | Checked-in build `1.0 (4)` references the ignored private app config in the `App` target and enables Push Notifications with environment-specific entitlements. The Mac build path must supply the production-bundle config and refresh signing before archive. Automatic token creation and delivery stay off. | Record bundle ID, TestFlight build, device date, and pass/fail only; no team IDs or provisioning details. |
| Device token registration | Signed-in Android and iOS devices register and refresh tokens without storing tokens in repo notes. | Record platform, build, tester alias, preference state, and pass/fail only. |
| Delivery and tap routing | Alerts deliver for the tested categories and open the matching in-app route. | Record category, route family, device, date, and pass/fail only; keep raw notification payloads private. |
| Preference controls | Per-device opt-out, quiet hours, and category preferences stop delivery as expected. | Record tested preference, platform, build, and pass/fail only. |

Do not claim native push support in store metadata until every row has a private
pass for both Android and iOS on the submitted builds.
Until that proof exists, repo-safe submission notes should refer to in-app
alerts and notification settings as the current fallback, not native push being
live, enabled, or ready.

## Native Push Config Probe

Run `npm.cmd run qa:native-push` from the repository root before changing a
native notification build. The probe reports only `ready` or `pending` states
for bridge wiring, private configuration, the inactive staging guard, the
service-only delivery outbox/sender, runtime activation, and evidence readiness;
it never prints app configuration values, device tokens, signing identifiers,
or notification payloads. The normal probe exits successfully so it can record
an honest staged state. `npm.cmd run qa:native-push:required` is the fail-closed
release gate and must remain failing until both platforms have their private
configuration, native capability wiring, client/server registration path,
server delivery credentials, and archived real-device alert/tap evidence.
The iOS checks also require an iOS FCM token bridge; APNs registration callbacks
alone do not produce the FCM token required by the planned delivery path. The
staging guard is intentionally not part of activation readiness because its
disabled permission/capability state is mutually exclusive with activation.

The scheduled sender queues only message notifications linked to an exact DM
row. It uses generic lock-screen copy, rechecks account state, the alert master
switch, message preferences, quiet hours, device activity, and the safe route
allowlist immediately before delivery. Its outbox, leases, retry state, and
device-token cleanup are service-only. All three UI, registration, and delivery
gates remain off until controlled Android and iOS QA.

The cross-platform bridge is staged with its guard active: automatic token
creation is disabled on both platforms and Android analytics collection is
disabled. Android declares notification permission so the signed build can ask
for it, but the app requests it only after a signed-in member explicitly opts in
and both setup and registration gates are enabled for controlled QA. Delivery
remains independently locked. The registration table is server-only, stores
each device against the authenticated account, and is cleaned for the current
device on opt-out and sign-out. A `ready` config probe still does not prove alert
delivery, tap routing, opt-out, or store-submitted build behavior; preserve that
evidence privately using the matrix above.

## Store Review Safety

- The app remains 18+.
- Visible nudity is not allowed for launch.
- User-generated content, reporting, blocking, moderation, DMs, public previews, marketplace/commerce limits, and account deletion must match the public Terms, Privacy, and Support pages.
- Store screenshots must follow `docs/SCREENSHOT_PREP.md`.
- Data Safety and App Privacy answers must be checked against `docs/DATA_SAFETY_PREP.md`.
- The iOS `PrivacyInfo.xcprivacy` file covers only the thin native wrapper and bundled native SDK behavior. Do not use its empty data arrays as the App Store App Privacy answer source; complete App Privacy from the live TTC web/app data flows in `docs/DATA_SAFETY_PREP.md`.
- Age-rating answers must be checked against `docs/AGE_RATING_PREP.md`.
- Real payments, seller payouts, taxes, shipping, refunds, disputes, and app-store commerce rules must pass `docs/PAYMENT_PRODUCTION_READINESS.md` before production commerce is promoted in native builds.

## QA Before Internal Testing

- Run `npm.cmd run verify` against the web app.
- Run the full `docs/REAL_DEVICE_QA_CHECKLIST.md` on mobile web before packaging.
- Before any Google Play submission or update on or after August 31, 2026, use the Android 16 / API 36 tooling now installed on this Windows machine and keep the Android wrapper `compileSdkVersion` and `targetSdkVersion` at 36. Rebuild and sign a fresh upload bundle, then rerun wrapper and real-device QA before selecting a Google Play submission/update track.
- Confirm `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/support`, `/child-safety-standards`, `/privacy`, `/terms`, `/messages`, `/notifications`, `/account`, public profiles, public posts, Stories, Stuff, Gigs, Merch, and booking/deposit routes do not reload-loop or overflow horizontally.
- Confirm a valid checked **Stay signed in on this device** session resumes after fully closing and relaunching each app, while an unchecked session remains session-only through server and browser token refreshes.
- Confirm TestFlight login, signup, forgot-password, reset-password, and email-confirmation routes stay inside the app WebView and do not push members out to Safari.
- Confirm install prompts or browser banners do not block scrolling in the wrapper.
- Confirm Android content and controls do not sit behind the clock, status icons,
  camera cutout, or navigation controls on gesture and three-button devices.
- Confirm videos do not show a visible download control in the wrapper media player.
- Confirm file uploads work through normal mobile file pickers.
- Confirm checkout returns safely to the app and does not expose raw payment or payout credentials in app forms.

## First Wrapper Steps

1. Keep the wrapper in `native/thetattoocore-mobile`.
2. Point the wrapper to `/login`.
3. Reuse TTC shield icons, maskable icon, splash, and store screenshots.
4. Configure app links/universal links for public profile, post, Story, Gossip, Stuff, Gigs, Merch, booking, support, Child Safety Standards, privacy, and terms routes.
5. Keep native permissions minimal.
6. Run Android internal testing and TestFlight before public submission.
7. Re-run real-device QA after every wrapper permission, deep-link, checkout, push, or upload change.
8. Enable Firebase/FCM notification delivery only after the native push plan above has real-device evidence for both apps.

Deep-link wiring is started in the wrapper. The always-mounted web bridge handles
both cold-start and warm Capacitor app URL events, accepts only exact TTC HTTPS
origins, and keeps the full path, query, and hash inside the WebView. Before
public release, add the final domain association files using the signed Android
certificate fingerprint and the Apple team/app identifier, then confirm profile,
post, Story, Gossip, Stuff, Gigs, Merch, booking, support, Child Safety Standards,
privacy, and terms links open inside the app.
iOS universal links are deferred for the first TestFlight build until the Apple
provisioning profile includes the Associated Domains capability.

The website now has fail-closed `.well-known` association routes for Android
App Links and iOS Universal Links. They return unavailable responses until the
final Google Play app-signing fingerprints and Apple app IDs are configured in
the private deployment environment. Do not commit real fingerprints, team IDs,
or provisioning details. Run `npm.cmd run smoke:app-links` after deployment to
confirm the live endpoints are either valid association JSON or the expected
fail-closed response.

## Verified Link Evidence Matrix

Keep completed evidence private with the release handoff. Do not commit signing
certificate fingerprints, Apple team identifiers, provisioning profile details,
console screenshots, tester account details, or raw device logs.

| Platform | Association file | Native entitlement or manifest proof | Device proof | Repo-safe result |
| --- | --- | --- | --- | --- |
| Android | `/.well-known/assetlinks.json` published on `thetattoocore.com` and `www.thetattoocore.com`, using the Google Play app-signing certificate fingerprint for `com.thetattoocore.app`. | Release manifest declares verified HTTPS app links with `android:autoVerify="true"` for the public TTC routes and the signed bundle installed from the intended Play testing track. | A real Android device opens profile, post, Story, Gossip, Stuff, Gigs, Merch, booking, Support, Child Safety Standards, Privacy, and Terms links inside the app without a chooser or browser bounce. | Record platform, build/version, release track, test date, device model, route set, and pass/fail only. |
| iOS | `/.well-known/apple-app-site-association` published on `thetattoocore.com` and `www.thetattoocore.com`, using the final Apple team/app identifier for `com.thetattoocore.app`. | Associated Domains capability is present in the provisioning profile and app entitlements for the submitted TestFlight/App Store build. | A real iPhone/TestFlight device opens profile, post, Story, Gossip, Stuff, Gigs, Merch, booking, Support, Child Safety Standards, Privacy, and Terms links inside the app without Safari bounce. | Record platform, build/version, TestFlight group, test date, device model, route set, and pass/fail only. |

Do not treat URL scheme handling, simulator-only checks, browser-sized mobile QA,
or unverified association files as public-release proof for app links.

## Android Target Evidence Matrix

Use this matrix before each Google Play release selection so the previously
uploaded internal-test bundle is not confused with a freshly rebuilt
public-submission build.

| Release path | Checked-in compile/target SDK | Required action | Repo-safe result |
| --- | ---: | --- | --- |
| Current Google Play closed test | Active release `1.0.2 (3)` and checked-in wrapper are `36 / 36` | Exact-build install and baseline device checks passed; collect explicit opt-in, token-registration, delivery, tap, opt-out, and applicable participation evidence while delivery stays off. | Record release track, version code/name, test date, device model, and pass/fail only. |
| Authorized Android review phone | Installed Alpha `1.0.2 (3)` targets API 36 | Required package probe, retained-session cold launch, system-bar framing, and permission-off baseline passed. Continue controlled notification QA only after explicit member opt-in. | Record installed build, permission state, device date, and pass/fail only. |
| Google Play replacement or update on or after August 31, 2026 | `36 / 36` required; current closed-test release is version code `3` / version name `1.0.2` | Increment above version code `3`, build from the checked-in API 36 wrapper, sign a fresh upload bundle, and rerun wrapper plus real-device QA. | Record API `36 / 36` rebuild proof, version code/name, device QA date, and pass/fail only. |

Any replacement must increment above version code `3`; never reuse a version code that Google Play has already served.

## Local Build Commands

From `native/thetattoocore-mobile`:

```powershell
npm.cmd install
npm.cmd run doctor
npm.cmd run sync
```

Android on Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
.\gradlew.bat bundleRelease
```

Android SDK and JDK 21 are configured on this Windows machine. For a Google Play upload build, load the local signing environment variables from the private Desktop recovery note, then run `.\gradlew.bat bundleRelease`. The signed upload bundle is `native/thetattoocore-mobile/android/app/build/outputs/bundle/release/app-release.aab`. Keep `android/local.properties`, `android/keystores/`, and all keystore recovery notes out of git.

iOS on Mac:

```bash
npm install
npm run sync
cd ios/App
pod install
open App.xcworkspace
```

Use Xcode to set the Apple team, confirm the bundle ID `com.thetattoocore.app`, archive, and upload the first build to TestFlight. iOS packaging cannot be completed from Windows.
