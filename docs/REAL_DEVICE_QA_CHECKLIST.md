# Real Device QA Checklist

Use this before native wrapper work, Google Play closed testing, TestFlight, or any production launch push. Run it on at least one Android phone and one actual iPhone/TestFlight device for release evidence. An iPhone-sized browser viewport is useful for layout scouting only and does not replace native iOS proof. Use safe sample content only.

## Setup

- Run `npm.cmd run smoke:public` against production and confirm public routes, private redirects, public fallback detail pages, metadata, and safety-copy checks pass.
- Run `npm.cmd run smoke:mobile` against production and confirm the 390px mobile browser checks pass for auth, support/help/legal, search/profile, missing-detail fallback, and checkout-status routes before manual device testing.
- Run `npm.cmd run smoke:mobile:ios` against production as an iPhone Safari-shaped scouting pass. This is useful for route, overflow, and error checks, but it does not replace the actual iPhone/TestFlight evidence below.
- Confirm the build points at `https://thetattoocore.com/login`.
- Confirm the Android device's selected Google Play account belongs to the configured tester community, then use the private web tester join link with that same account and confirm opt-in before opening the Android join link.
- Confirm the closed-test store listing offers Install or Update, then verify the installed Android app came from the intended Google Play closed-testing track and record the release/build number shown to testers.
- Treat a missing listing, mismatched Play account, unconfirmed web opt-in, or unpropagated tester-community membership as a blocker, not an install pass.
- Confirm the installed iOS app came from the intended TestFlight group and record the version/build number shown to testers.
- Open Admin > Media Ops and confirm the Beta QA launch checklist is visible for auth, two-user DMs, mobile posting/media, verification review, controlled launch payments, and safe store screenshots.
- Confirm Support, Help, Child Safety Standards, Privacy, and Terms links open from logged-out and logged-in surfaces.
- Open Help Center on mobile, search for "getting started", and confirm the first-run guide explains account type, profile setup, privacy, content rules, main sections, verification, and Support.
- Open Help Center on mobile, search for "beta app", and confirm the beta app testing guide explains in-app login/signup/reset, media upload, notifications, DMs, booking, Merch, checkout return paths, and safe bug reporting.
- Open Help Center on mobile, search for "saved", and confirm the Search/Saved guide explains usernames, broader terms like tattooers, guest spots, and shirts, privacy-safe results, and saved search shortcuts.
- Open the Help Center privacy/safety/support guide on mobile and confirm it explains reports, blocks, account deletion requests, support boundaries, and private account issues.
- Open the Booking guide and confirm it explains deposit confirmation, TTC fee visibility, private calendar-note limits, and refund-review expectations.
- Open the Ads guide and confirm it explains 4U/Gossip placements, Merch-only ads, ad credits, review rules, keyword safety, and payment status.
- Open the Merch guide and confirm it explains private buyer shipping details, tracking, seller fulfillment timing, missing/damaged/wrong/delayed/returned package support, and refund-review expectations.
- Open the Order Support guide and confirm it explains missing, damaged, wrong, delayed, returned, disputed, and seller-non-delivery orders without telling members to post private evidence publicly.
- Open the Verification guide and confirm it explains document privacy, why approval matters, unlocked tools, and resubmission after rejection.
- Confirm public app copy uses `support@thetattoocore.com` or final company contact details, not personal owner contact data.
- Confirm the browser/install prompt does not block vertical scrolling after the user ignores it.
- Confirm light mode and dark mode text is readable on every tested route.

## Auth And Account

- Create a new account from `/signup` with the 18+ checkbox.
- Confirm email delivery and confirmation redirect.
- Sign in from `/login`; confirm the signup controls are not mixed into the login form.
- Leave **Stay signed in on this device** checked, sign in, fully close and relaunch the Android and iOS apps, and confirm the valid session resumes into the app instead of showing the login form again.
- Uncheck **Stay signed in on this device** on a separate QA session and confirm the session is not converted back to a persistent cookie during normal navigation or token refresh. Keep credentials and cookie values out of repo-safe evidence.
- Run forgot-password and reset-password flows.
- Complete profile setup with avatar, display name, username, bio, website, social links, language, country, and coarse location.
- Confirm profile tabs fit mobile screens and do not create horizontal page overflow.
- Confirm account deletion request flow creates a request and shows clear next steps.

## Core Social

- Create a 4U image post and a short video post.
- Use the image crop tools before posting in at least one upload area; confirm original, square, portrait, landscape, or banner framing previews update and the final upload uses the selected crop.
- Create a Story photo/GIF/short video and confirm it appears in the Stories rail, opens in the media viewer, plays videos without a visible download button, and expires from the rail after the expiry window.
- With no active Stories, confirm the rail shows a clear "No active stories yet" prompt instead of disabled or coming-soon placeholders.
- Open a Story from a public profile and confirm signed-in viewers can react, send a DM reply, and report from the viewer without opening the wrong composer.
- Confirm 4U captions respect the 40-word limit.
- Open 4U media in the lightbox, zoom images, play videos, and confirm video controls do not show a download button.
- Create a Gossip post with longer text and optional image.
- Like, save, share, report, edit, and delete owned 4U/Gossip content.
- Tag another known test account from 4U, Gossip, Gigs, and comments where available; confirm the tagged member receives the correct in-app alert.
- Delete or untag the tagged 4U, Gossip, Gig, or comment test item and confirm the tagged member no longer has a stale notification that opens to a blocked, missing, or unauthorized page.
- Confirm home cards show comment counts only, then open detail pages for full comments.
- Add, like, reply to, edit, delete, and report comments where supported.
- Attach a photo/GIF to 4U and Gossip detail comments/replies, then open the attachment in the lightbox.
- Confirm post owners can hide/delete disruptive comments where supported.
- Search for a public profile and a private profile connected by an accepted follow relationship; confirm signed-in search finds both while logged-out search stays public-only.

## Commerce And Listings

- Create, edit, archive, and view a Stuff listing as an eligible verified account.
- Confirm non-verified users can browse Stuff but cannot transact or contact sellers.
- Create, edit, archive, and view a Gig.
- Create, edit, archive, and view a Merch product.
- Open the Merch storefront on mobile and confirm the Merch Help and Seller Tools links are visible without horizontal overflow.
- Run controlled launch checkout for Merch and verify success, receipt, buyer history, seller history, admin payments, and webhook status.
- Open a Merch product detail page before checkout and confirm the Merch Help link is visible near checkout guidance.
- Confirm checkout remains launch-controlled until production payment, tax, refund, dispute, shipping, and payout policy is approved.

## Messaging

- Confirm the main swipe tabs are 4U, Gossip, Stuff, Gigs, and Merch only; DM access should come from the bottom DM shortcut, profile DM buttons, notifications, Story replies, or `/messages`.
- Start a DM from another user's profile and confirm the recipient field/thread target is correct.
- In the DM inbox start form, type part of a connected follower/following member's username, display name, city, or region; confirm matching profile suggestions appear, selecting one fills the target, and the first message opens the correct thread.
- Send and receive a text message between two known test accounts.
- Send and receive a DM photo attachment.
- Open a selected DM thread on mobile and confirm the header and message input stay fixed while only the sent-message list scrolls.
- Tap the other member's name/avatar in the DM header and message list; confirm it opens that member's profile.
- Confirm delivered/read indicators update.
- Delete an unread outgoing DM and confirm it disappears for the sender without breaking the thread.
- Open a DM notification and confirm it routes to the correct thread without reload loops.
- Create a booking request, accept it with an appointment time, and confirm both Account and DM cards show the scheduled time plus a private Add to calendar download.

Repo-safe two-user DM evidence should record only tester aliases, device models, release channel/build, message direction, read/reply result, attachment result, notification-route result, and pass/fail status. Keep email addresses, passwords, one-time codes, private message bodies, screenshots with real DM text, and account-owner details in the private release handoff only.

## Notifications

- Trigger notifications for likes, comments, replies, follows, follow requests, DMs, verification decisions, ad payments, and Merch order events where available.
- Open each notification type on mobile and confirm the target page stays inside the viewport.
- Confirm notification lists paginate or load more instead of growing into one long unbounded page.
- Confirm quiet-hours/category preferences save and display correctly.

## Verification And Admin

- Submit artist, studio, and vendor verification with a private license document under the current upload limit.
- Confirm submission success does not reload-loop or expose the license document publicly.
- Approve and reject verification from Admin > Verification.
- Confirm member notifications and important email behavior for verification decisions.
- Review Admin > Users, Verification, Reports, Content, Stuff, Gigs, Merch, Ads, Payments, Data Requests, Media Ops, and Mail Settings on mobile.
- In Admin > Payments, search by a safe test payment/event reference or booking title and confirm webhook receipts, payment audit rows, and booking deposits remain paginated and filterable.
- In Admin > Merch, search by a product/order/customer/payment reference and confirm product and order queues remain paginated and filterable.
- In Admin > Content > Stories, confirm temporary story rows show whether they expire soon or already expired.
- Confirm each admin page uses pagination or focused queues and the overview remains short.
- Confirm dark/light admin contrast is readable.

## Public Sharing And Safety

- Open public profile, 4U, Gossip, Stuff, Gigs, and Merch shared links while logged out.
- Confirm public-safe links show limited previews and correct Open Graph metadata.
- Confirm private routes redirect to `/login` with the right return path.
- Confirm sensitive or admin-restricted legacy content stays locked or blurred for logged-out users and does not expose the full media URL.
- Confirm visible nudity upload copy is removed from upload forms and the no-visible-nudity policy is clear.
- Confirm report/block tools are reachable and understandable on mobile.

## PWA And Store Readiness

- Install the PWA from the deliberate install action where supported.
- Confirm installed app start URL is `/login`.
- Confirm app icon, maskable icon, splash, shortcuts, and screenshots use TTC-branded assets.
- Confirm no default framework scaffold assets appear in install or review surfaces.
- Confirm service worker registration does not break routing, refresh, logout, or media loading.
- Confirm screenshots prepared for stores contain no private DMs, copyrighted tattoo art, nudity, license documents, personal email addresses, or real payment data.

## Pass Criteria

- No reload-loop screens.
- No document-level horizontal overflow on mobile.
- No unreadable white-on-white or black-on-black controls.
- No console errors during the tested happy paths.
- No personal owner contact data on public support/legal/store surfaces.
- No private, sensitive, admin-only, or full-resolution restricted media visible to logged-out users.

## Evidence Pack Template

Create one dated evidence pack for each release candidate before store review. Keep the pack private, use safe sample content only, and avoid screenshots or clips that show private DMs, license documents, admin-only queues, real payment data, personal contact details, or visible infrastructure/provider names.

Run `npm.cmd run prepare:private-release-handoff` from the repo root when you
need a blank local template for release-candidate evidence. The generated
`private-release-handoff/` folder is ignored by git and is intended for private
console, device, payment, legal, and push-delivery evidence only.

For each device pass, record:

- Tester name or initials.
- Test date.
- Platform and device model.
- OS version.
- App build or web deploy version.
- Native install source, such as Google Play closed testing or TestFlight, plus release track, version, and build number.
- Network used, such as Wi-Fi or cellular.
- Test accounts used, including the second known account for two-user DM read/reply checks.
- Routes or native screens tested.
- Pass/fail result for each checklist area.
- Screenshot or clip filename for each store-critical proof screen.
- Notes for any retry, bug, moderation action, checkout return, report/block action, or support handoff.
- Console/log review result for web browser, Android wrapper WebView, and iOS TestFlight where available. Record pass/fail and a short safe summary only; keep raw logs, stack traces with account data, device identifiers, and console screenshots in the private handoff.

Store-critical proof should include at least:

- Android closed-testing install proof and iOS TestFlight install proof for the exact build under review.
- Android and iOS login/signup/reset staying inside the app or installed-app flow.
- Public Help, Support, Child Safety Standards, Privacy, and Terms links opening correctly.
- Posting, Story viewing, reporting, blocking, and account deletion request.
- Full two-user DM send, receive, read indicator, reply, photo attachment, and notification route.
- 4U, Gossip, Gigs, and comment tagging proof, including stale notification cleanup after delete or untag.
- Verification upload success and admin approval/rejection evidence without exposing private documents.
- Merch browsing, controlled checkout return, order history, and Admin Payments review evidence using safe test references.
- Screenshot upload candidates that match `docs/SCREENSHOT_PREP.md`.
- Accessibility Nutrition Labels proof for the submitted iPhone/iPad build, including common-task checks for VoiceOver, Voice Control, Larger Text, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion, Captions, and Audio Descriptions before claiming support in App Store Connect.
- Browser/device console check showing no uncaught app errors during auth, posting, DMs, checkout return, reporting/blocking, and Help/Support/legal routes.

## Accessibility Nutrition Labels Evidence Matrix

Use this matrix before answering App Store accessibility labels. Test only the submitted iPhone/iPad build, mark unsupported features honestly, and keep raw device clips, tester notes, and private account details in the private release handoff.

| Common task | VoiceOver | Voice Control | Larger Text | Differentiate Without Color Alone | Sufficient Contrast | Reduced Motion | Captions | Audio Descriptions | Repo-safe note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign up, log in, reset password, and open Help/Support/legal links. | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `not applicable` or tested result | `not applicable` or tested result | Record build, device, date, and pass/fail only. |
| Navigate 4U, Gossip, Stuff, Gigs, Merch, Search, profile, Settings, and Account. | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `not applicable` or tested result | `not applicable` or tested result | Record only non-sensitive route names and result. |
| Create a safe post/Story, report/block content, and submit account deletion request. | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `not applicable` or tested result | `not applicable` or tested result | Keep sample content and report IDs private. |
| Complete the two-user DM pass, including reply, read indicator, attachment, and notification route. | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `not applicable` or tested result | `not applicable` or tested result | Record tester aliases only; no DM text or screenshots with private messages. |
| Run verification upload, booking request/deposit return, Merch browsing/order history, and controlled checkout return paths. | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `pass`, `partial`, or `not supported` | `not applicable` or tested result | `not applicable` or tested result | Keep payment, license, address, and admin review evidence private. |

Repo-safe accessibility summary fields are limited to release candidate, platform, submitted build, device model, test date, common task, accessibility feature, result, and a short non-sensitive note. Do not commit private messages, payment data, license documents, console screenshots, account identifiers, tester emails, or personal contact details.

## Native Build And Install Evidence Matrix

Keep completed rows in the private release handoff. Do not commit screenshots or clips that show reviewer secrets, private contact numbers, account owner details, payment-account data, console identifiers, private DMs, license documents, or admin-only queues.

| Platform | Release channel | Version/build proof | Install-source proof | Tester account pair | Device/date | Result summary |
| --- | --- | --- | --- | --- | --- | --- |
| Android | Google Play closed testing. | Version name, version code, release track, and closed-test date range for the exact build under review. | Screenshot or clip proving the app was installed from the intended closed-testing track; keep tester-community handoff, same-account web opt-in, 12-tester participation, 14-day duration, feedback summary, and production-access request result in the private handoff if required. | Primary tester and second known DM tester, recorded privately. | Android device model, OS version, test date, and network. | Pass/fail for auth, posting, DMs, verification, checkout return paths, report/block, screenshots, and Play testing evidence. |
| iOS | TestFlight internal testing | iOS version/build number and tester group for the exact build under review. | Screenshot or clip proving the app was installed from the intended TestFlight group. | Primary tester and second known DM tester, recorded privately. | iPhone model, iOS version, test date, and network. | Pass/fail for auth, posting, DMs, verification, checkout return paths, report/block, and screenshots. |

If a device is physically connected but automation is unavailable, such as Android
platform tools or `adb` missing from Windows PATH, record `manual evidence only:
automation unavailable` in the private handoff. Capture install-source, build,
device, date, and checklist pass/fail proof manually, then rerun automated device
capture after platform tools are installed. Do not treat missing automation as a
passing console/log review.

## Android Connected-Device Probe

Use this Windows probe before claiming Android real-device evidence. A connected
USB cable is not enough: the device must appear in `adb devices -l` as an
authorized `device`, and the installed package must match the active Google
Play closed-testing build.

By default, the probe compares the installed package against the Android
`versionName` and `versionCode` checked into
`native/thetattoocore-mobile/android/app/build.gradle`. If the selected Play
track intentionally uses a different build, set
`TTC_ANDROID_EXPECTED_VERSION_NAME` and `TTC_ANDROID_EXPECTED_VERSION_CODE` in
the private release shell before rerunning the probe.

For a repo-safe status summary from this machine, run:

```powershell
npm.cmd run qa:android-device
```

To make the command fail until an authorized device is visible and the TTC
package is installed for the active closed-test build, run:

```powershell
npm.cmd run qa:android-device:required
```

If the device has an older build, unlock it and open the active closed-test
enrollment page directly from the Windows QA command:

```powershell
npm.cmd run qa:android-device:open-test
```

This command only opens the enrollment page on the authorized device. The
tester must already belong to the configured Google Group, join the test with
the eligible Google account, and install the update through Google Play before
the exact-build probe can pass.

The required gate waits briefly for the USB/debug authorization state to settle
before failing, so leave the phone unlocked and accept the computer prompt if it
appears.

Before treating an Android/iOS wrapper build as release-ready, run the stricter
native release gate:

```powershell
npm.cmd run verify:native-predevice
```

Use this pre-device native readiness scout before screenshot, console-copy, or
handoff review while the Android review device is not authorized yet. It checks
environment boundaries, native wrapper safety, app-link association endpoints,
readiness docs, store metadata, Android-profile mobile routes, and iOS-profile
mobile routes, but it is not real-device evidence. It also validates the
private handoff template before console-copy or screenshot evidence collection.

```powershell
npm.cmd run verify:native-release
```

This command checks production environment boundaries, private native config
exclusions, app-link association endpoints, private handoff-template validation,
and readiness docs first, then is expected to fail while no authorized Android device
with the review build installed is visible. A pass means the
environment guard, native wrapper guard, app-link association guard, private
handoff-template guard, docs guard, Android connected-device/package probe,
store metadata guard, Android-profile mobile smoke, and iOS-profile mobile smoke
all passed for the same release candidate.

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb devices -l
& $adb shell getprop ro.product.model
& $adb shell getprop ro.build.version.release
& $adb shell dumpsys package com.thetattoocore.app | Select-String "versionName|versionCode"
& $adb shell monkey -p com.thetattoocore.app 1
& $adb shell am start -W -a android.intent.action.VIEW -d "https://thetattoocore.com/login"
```

If `adb devices -l` is empty, says `unauthorized`, shows a different device
state, or the probe reports `authorized device missing TTC package`, record
`Android automation not yet available` in the private handoff and do not count it
as a passing Android console/log review. Enable USB debugging, accept the device
authorization prompt, install or confirm the Play-installed build, then rerun the
probe before capturing route, login, DM, notification, checkout-return, and
store-screenshot evidence.

If the probe reports `authorized device has wrong TTC build`, record the
installed and expected version/build values in the private handoff, run
`npm.cmd run qa:android-device:open-test`, join the active closed test with an
eligible account, install the exact Google Play build, and rerun the probe
before counting the device as ready.

Repo-safe summary fields are limited to platform, release channel, version/build, date, device model, and pass/fail status. Keep tester secrets, private contact details, account identifiers, and raw console screenshots private.
