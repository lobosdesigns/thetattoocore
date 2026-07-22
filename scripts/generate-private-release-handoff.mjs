import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = "private-release-handoff";
const outputPath = join(outputDir, "release-handoff-template.md");

const today = new Date().toISOString().slice(0, 10);

const template = `# TheTattooCore Private Release Handoff

Generated: ${today}

Keep this file private. Do not commit this folder or paste completed rows into
repo docs. Use safe aliases and short pass/fail summaries in repo-visible docs.

## Release Candidate

| Field | Value |
| --- | --- |
| Web deploy version | |
| Android release track and version/build | |
| iOS TestFlight version/build | |
| Store-review target date | |
| Reviewer contact saved in consoles | pending |
| Reviewer account validated for selected build/track | pending |

## Current Console Blockers To Clear

Record private proof when each blocker is cleared. Keep console screenshots and
account identifiers out of repo docs.

| Platform | Blocker | Current handoff value | Result | Private proof filename or location |
| --- | --- | --- | --- | --- |
| Apple | App Review monitoring and response evidence | App Store Connect shows iOS App Version 1.0 build 1.0 (3) submitted for App Review; archive reviewer messages, status changes, rejection notes, or approval proof privately | pending | |
| Apple | Submitted-build console field evidence | Confirm selected build, 13-inch iPad screenshot upload, primary category, free pricing, Content Rights, App Privacy, Privacy Policy URL, and Age 18+ override remain saved for the submitted build | pending | |
| Apple | Accessibility Nutrition Labels evidence | Use submitted-build iPhone/iPad QA evidence only before changing or confirming labels | pending | |
| Google Play | Closed testing production-access evidence | Confirm Closed testing - Alpha release 1 (1.0) is served to the tester community, tester opt-ins are sufficient, and the 14-day window is counted only after the closed test is live | pending | |
| Google Play | Closed-test tester links and opt-in evidence | Save Android/web join links privately, confirm the device Play account matches the tester-community member, confirm web opt-in with that account, and record listing/install proof | pending | |
| Google Play | API 36 signed upload bundle | Fresh version code 2 / version name 1.0.1 API 36 upload bundle is staged; upload it when required or before any post-deadline submission/update, then rerun Android wrapper plus real-device QA | pending | |
| Google Play | Console submit/retry evidence | If Play Console errors before submit, record the visible error code, page URL, retry path, whether reload/new-tab retry was attempted, and whether Publishing overview still shows changes not sent for review | pending | |

## Store Console Evidence

| Area | Apple result | Google Play result | Private proof filename or location | Repo-safe summary |
| --- | --- | --- | --- | --- |
| Build selection | pending | pending | | |
| Google Play API 36 signed upload bundle | n/a | pending | | |
| Google Play closed-test tester links | n/a | pending | | |
| Google Play phone screenshots | n/a | pending | | |
| Google Play feature graphic | n/a | pending | | |
| App Store iPhone 6.5-inch screenshots | pending | n/a | | |
| App Store 13-inch iPad screenshots | pending | n/a | | |
| Category and pricing | pending | pending | | |
| Content rights | pending | n/a | | |
| App Privacy / Data Safety | pending | pending | | |
| Age/content rating | pending | pending | | |
| Accessibility Nutrition Labels | pending | n/a | | |
| Production-access closed test, if required | n/a | pending | | |
| Final validation and submit readiness | pending | pending | | |

## Private Console Tab Restore

Use this only when active launch-console tabs need a crash-safe handoff. Keep the
generated restore file and exact console URLs private.

| Restore file | Covered tabs | Last refreshed | Result |
| --- | --- | --- | --- |
| Desktop / TheTattooCore Launch Console Tabs.html | Google Play, App Store Connect, Firebase console, payment dashboard, owner TTC app session | pending | pending |

## Google Play Closed-Test Retry Log

Use this only for private console evidence. Keep raw screenshots and account
identifiers in the private proof folder.

| Attempt date/time | Console page | Visible status or error code | Action tried | Result | Next retry owner |
| --- | --- | --- | --- | --- | --- |
| | Closed testing / Publishing overview | active or pending status to capture | reload and saved-tab retry if status changes or install link fails | pending | |

## Google Play Tester Install Evidence

Keep account emails, group-membership screenshots, and exact tester links private.
A missing listing, account mismatch, or unconfirmed web opt-in is a blocker, not a
passing install.

| Tester alias | Device Play account matches tester member | Web opt-in accepted | Android listing offers Install/Update | Installed release/version/build | Device and date | Result |
| --- | --- | --- | --- | --- | --- | --- |
| | pending | pending | pending | | | pending |

## Reviewer Access

| Platform | Tester alias | Account state | Build or track validated | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Apple | | email-confirmed | | pending | |
| Google Play | | email-confirmed | | pending | |

## Real-Device QA

| Platform | Device model | OS version | Build or deploy version | Install source | Network | Result | Proof filename |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Android | | | | | | pending | |
| iOS | | | | | | pending | |

## Two-User DM Evidence

| Platform | Sender alias | Recipient alias | Text send/read/reply | Attachment | Notification route | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Android | | | pending | pending | pending | pending |
| iOS | | | pending | pending | pending | pending |

## Payment And Commerce Evidence

| Flow | Release candidate | Expected mode checked | Server key mode checked | Webhook endpoint/events checked | Admin reconciliation | Refund/dispute/payout gate | Penny/live-test proof | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Merch checkout | pending | pending | pending | pending | pending | pending | pending | pending |
| Booking deposit | pending | pending | pending | pending | pending | pending | pending | pending |
| Ads checkout | pending | pending | pending | pending | pending | pending | pending | pending |
| Seller payout readiness | pending | pending | pending | pending | pending | pending | n/a | pending |

## Payment Dashboard Readiness Log

Use this for private payment dashboard evidence before any live-money cutover.
Do not copy account identifiers, key fragments, event IDs, connected-account IDs,
bank/card details, or dashboard screenshots into repo docs.

| Attempt date/time | Area | Visible readiness item | Result | Private proof filename or location | Next owner |
| --- | --- | --- | --- | --- | --- |
| | Account verification | Verify email, business, profile, verified status, and identity readiness | pending | | |
| | Connect setup | Business model, connected-account test, and integration-guide choices | pending | | |
| | API and webhook mode | Expected live/test mode, server key mode, webhook endpoint, and event list match the release candidate | pending | | |
| | Live-money proof | Penny test, Admin reconciliation, refund/dispute procedure, payout gate, and native checkout policy review | pending | | |

## Native Push Evidence

Use this for private Android/iOS alert evidence only. Keep project IDs, sender
IDs, app config files, device tokens, notification payloads, signing details,
and console screenshots out of repo docs.

| Evidence area | Platform | Required private proof | Repo-safe result | Private proof filename or location |
| --- | --- | --- | --- | --- |
| Project exists | Android and iOS | TTC push project exists with Android and iOS apps registered for com.thetattoocore.app | pending | |
| Android app config | Android | Android app config is present only in the private build environment and excluded from git | pending | |
| iOS app config | iOS | iOS app config is present only in the private build environment and excluded from git | pending | |
| Device token registration | Android | Signed Android build requests permission only after opt-in, registers a device token, and stores it for the signed-in tester | pending | |
| Device token registration | iOS | TestFlight build requests permission only after opt-in, registers a device token, and stores it for the signed-in tester | pending | |
| Alert delivery | Android | Test alert reaches the Android device for the selected release track and build | pending | |
| Alert delivery | iOS | Test alert reaches the iOS device for the selected TestFlight build | pending | |
| Tap routing | Android | Tapping the alert opens the expected safe in-app destination | pending | |
| Tap routing | iOS | Tapping the alert opens the expected safe in-app destination | pending | |
| Preferences respected | Android and iOS | Opt-out, quiet hours, and category preferences suppress delivery where expected | pending | |

## Legal And Policy Review

| Area | Reviewer role or initials | Review date | Result | Notes |
| --- | --- | --- | --- | --- |
| Terms and Privacy match submitted build | | | pending | |
| Account deletion language and handling | | | pending | |
| Commerce, refunds, disputes, taxes, and shipping | | | pending | |
| Native checkout/store policy classification | | | pending | |
| Store metadata and screenshots | | | pending | |

## Legal Submission Signoff Matrix

Complete this for the exact build, release track, and web deploy being
submitted. Repo-visible summaries should keep only pass/fail/blocker status.

| Area | Required private decision | Result | Reviewer role or initials | Review date | Private proof filename or location |
| --- | --- | --- | --- | --- | --- |
| Public legal URLs | Terms, Privacy, Support, Help, Child Safety Standards, and account deletion request path match the submitted build and store metadata | pending | | | |
| Account deletion and retention | Deletion SLA, manual review owner, retention exceptions, legal holds, moderation records, verification history, and payment/order records are approved | pending | | | |
| UGC and safety policy | 18+ eligibility, no visible nudity, no scratcher promotion, no AI art/search claims, report/block tools, moderation escalation, and restricted-equipment handling are approved | pending | | | |
| Store questionnaires | App Privacy/Data Safety, age/content rating, Accessibility Nutrition Labels, content rights, pricing, category, reviewer notes, and screenshot validation match the exact build | pending | | | |
| Commerce and payments | Checkout exposure, native payment-policy classification, tax/shipping assumptions, fulfillment timing, refunds, disputes, booking deposits, ad purchases, and seller payout timing are approved or explicitly gated | pending | | | |
| Evidence privacy | Reviewer credentials, phone details, console screenshots, payment identifiers, buyer addresses, private DMs, license documents, and owner personal details remain outside repo-visible docs | pending | | | |

## Private-Data Rules

- Do not commit reviewer passwords, one-time codes, tester emails, personal phone
  details, account identifiers, raw device logs, console screenshots, payment
  identifiers, bank/card details, private DMs, license documents, buyer addresses,
  or private user content.
- Repo-visible summaries should use only platform, release channel, version/build,
  test date, device model, area tested, pass/fail/blocker status, and a short
  non-sensitive note.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, template);
console.log(`Created ${outputPath}`);
