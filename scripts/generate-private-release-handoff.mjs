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

## Store Console Evidence

| Area | Apple result | Google Play result | Private proof filename or location | Repo-safe summary |
| --- | --- | --- | --- | --- |
| Build selection | pending | pending | | |
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

| Flow | Mode checked | Webhook coverage | Admin reconciliation | Refund/dispute path | Seller payout readiness | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Merch checkout | pending | pending | pending | pending | pending | pending |
| Booking deposit | pending | pending | pending | pending | n/a | pending |
| Ads checkout | pending | pending | pending | pending | n/a | pending |

## Native Push Evidence

| Platform | App config private | Token registration | Alert delivery | Tap routing | Preferences respected | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Android | pending | pending | pending | pending | pending | pending |
| iOS | pending | pending | pending | pending | pending | pending |

## Legal And Policy Review

| Area | Reviewer role or initials | Review date | Result | Notes |
| --- | --- | --- | --- | --- |
| Terms and Privacy match submitted build | | | pending | |
| Account deletion language and handling | | | pending | |
| Commerce, refunds, disputes, taxes, and shipping | | | pending | |
| Native checkout/store policy classification | | | pending | |
| Store metadata and screenshots | | | pending | |

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
