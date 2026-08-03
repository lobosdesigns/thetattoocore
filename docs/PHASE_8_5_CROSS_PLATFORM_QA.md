# Phase 8.5 Cross-Platform QA Report

Date: 2026-07-30

Branch: `qa/cross-platform-v1.1.0`

Starting commit: `4dfeb8f362ee433deaecc522b2bb792b761d5814`

Scope: branch-local v1.1.0 readiness QA. No deployment, merge, tag, production migration, or production configuration change was performed.

## Current Seller-Link QA Interpretation - August 2, 2026

- Seller-owned Payment Links are the current Merch model. TTC reviews listing and link safety; the seller processes payment and handles tax, shipping, returns, refunds, disputes, receipts, and purchase support.
- Current release evidence must cover listing disclosure, intentional external-browser open and return on web, Android phone, and TestFlight iPad, and no false TTC payment, order, receipt, or success state.
- Admin payment rows are relevant only for historical TTC seller-payout reconciliation. They do not prove a new seller-owned external purchase.
- The prior TTC Checkout and seller-payout results in this July 30 report are historical, non-operative evidence. They do not authorize Checkout, Connect, a Merch platform fee, a payout release, or a seller-link rollout.

## Summary

Phase 8.5 branch-local automated QA passed after validating the required build, smoke, security, admin, disposable database, PWA, native-wrapper, and browser viewport checks. No reproducible branch-local cross-platform defect was found, so no source fix or regression test was added.

One live-production `smoke:public` run against `https://thetattoocore.com` failed for `/u/ceocore/followers` and `/u/ceocore/following` with 404 responses. The same required smoke passed against the local v1.1.0 QA branch server at `http://127.0.0.1:4110`, and the local production build route table includes both routes. This is recorded as a certified-production/v1.1.0 candidate mismatch, not a reproduced v1.1.0 branch defect.

One 1280x720 local browser pass hit `net::ERR_NO_BUFFER_SPACE` on `/account`. A full 1280x720 rerun passed, including `/account`, so the failed pass is recorded as local Edge Chromium resource exhaustion.

## Tested Environment

- OS: Windows local QA environment.
- Local server command: `npx.cmd next start -p 4110`.
- Local server URL: `http://127.0.0.1:4110`.
- Browser engine used for automated browser checks: installed Microsoft Edge Chromium at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` through `CHROME_PATH`.
- Chrome/Chromium on PATH: unavailable.
- Firefox: unavailable at `C:\Program Files\Mozilla Firefox\firefox.exe` and not on PATH.
- Safari: unavailable on this Windows environment.
- Physical iPhone, iPad, Android phone, and Android tablet: not tested by Codex.

## Browser And Viewport Matrix

All listed branch-local viewport checks used `SMOKE_BASE_URL=http://127.0.0.1:4110` and Edge Chromium via `CHROME_PATH`.

| Viewport | Orientation class | Result |
| --- | --- | --- |
| 320x568 | phone portrait, narrow | Pass |
| 360x800 | phone portrait | Pass |
| 390x844 equivalent default profile | phone portrait | Pass |
| 412x915 | phone portrait | Pass |
| 768x1024 | tablet portrait | Pass |
| 820x1180 | tablet portrait | Pass |
| 1024x768 | tablet landscape | Pass |
| 1280x720 | desktop or phone landscape class | Pass after rerun |
| 1440x900 | desktop | Pass |
| 1920x1080 | desktop | Pass |

## Flow Results

- Homepage: pass in public and browser smoke.
- Search: pass for empty/common/hostile/profile/merch query coverage in smoke and contract tests.
- Profile: pass for `/u/ceocore`, tab anchors, followers, and following branch-locally.
- Shop and studio-related profile surfaces: pass through profile/shop-link guards and public route smoke coverage.
- Merch: the July 30 branch pass covered the former storefront, product fallback, TTC checkout, and seller-payout guards. That is historical TTC-owned checkout evidence only and is non-operative for the current seller-link release.
- Gigs: pass for public fallback and admin queue guard coverage.
- Messaging: pass for inbox, selected thread route, recipient prefill, pagination/read-position guards, blocked-member filters, notifications, and disposable DB contracts.
- Notification center: pass for signed-out route, notification-open URL safety, blocked actor filtering, stale target cleanup, and push contract guards.
- Booking: pass for public profile booking availability, guarded checkout, input security, calendar/download contract, conflict and cancellation guard coverage, and disposable lifecycle DB contracts.
- Admin denial: pass for `/admin` and dedicated admin routes, noindex/no-store/private header guards, and signed-out public smoke coverage.
- Help/legal/404/sitemap/robots: pass branch-locally. Live robots checks had edge-challenge warnings only.

## PWA, Native, And Platform Behavior

- Manifest: pass.
- Icons and screenshots referenced by manifest: pass.
- Install prompt gating: pass.
- Service worker registration guard: pass.
- Offline shell fallback: pass through `offline.html` public smoke and PWA guard.
- Notification click route allowlist: pass.
- Private API/data caching guard: pass through PWA, security, and performance/reliability checks.
- Standalone display mode: source/manifest guard passed; real installed PWA behavior not physically tested.
- Safe-area source guards: pass for `viewportFit: "cover"` and platform safe-area inset usage in native/PWA smoke.
- Keyboard/input behavior: automated browser smoke passed route-level console/overflow checks; real mobile keyboard behavior was not physically tested.
- Upload and camera-facing behavior: source guards for image-only DM attachments, verification upload privacy/size guards, and media upload safety passed; real camera/photo picker behavior was not physically tested.
- Native wrapper behavior: pass through native smoke and native session contracts; no physical native app runtime was tested.
- Notifications: push setup, denied/unavailable copy, route safety, and native push gating passed guard tests; real system push delivery was not tested.
- Accessibility: automated/source guard coverage passed where present; no screen reader or physical accessibility pass was run.

## Defects And Observations

### Medium: Live production follower/following routes differ from v1.1.0 candidate

- Route: `/u/ceocore/followers`, `/u/ceocore/following`.
- Browser/viewport: fetch-based public smoke against `https://thetattoocore.com`.
- State: signed out.
- Steps: run `npm.cmd run smoke:public` with default production target.
- Expected: 200 with `CEOCore` and `Back to profile`.
- Actual: 404 for both routes.
- Evidence: live production public smoke failed; branch-local public smoke passed against `http://127.0.0.1:4110`.
- Classification: existing production/certified-release mismatch, not reproduced on v1.1.0 QA branch.
- Fix: none.

### Low: Local Edge Chromium resource exhaustion during repeated viewport pass

- Route: `/account`.
- Browser/viewport: Edge Chromium, 1280x720, local server.
- State: signed out.
- Steps: run repeated browser smoke matrix passes.
- Expected: no console/page errors.
- Actual: one run reported `Failed to load resource: net::ERR_NO_BUFFER_SPACE`.
- Evidence: full 1280x720 rerun passed, including `/account`.
- Classification: QA environment transient.
- Fix: none.

## Commands And Results

| Command | Target | Result |
| --- | --- | --- |
| `git fetch origin` | git safety | Pass |
| `git pull --ff-only origin develop` | git safety | Pass, already up to date |
| `git switch -c qa/cross-platform-v1.1.0` | branch setup | Pass |
| `node_modules\.bin\tsc.cmd --noEmit` | static typecheck | Pass |
| `npm.cmd run lint` | lint | Pass |
| `npm.cmd run build` | Next production build | Pass |
| `npx.cmd opennextjs-cloudflare build` | OpenNext Cloudflare build | Pass |
| `npm.cmd run smoke:public` | default production target | Failed on production-only follower/following mismatch |
| `SMOKE_BASE_URL=http://127.0.0.1:4110 npm.cmd run smoke:public` | local QA server | Pass |
| `npm.cmd run smoke:mobile` | 390px local Edge Chromium | Pass |
| `npm.cmd run smoke:mobile:narrow` | 320x568 local Edge Chromium | Pass |
| `npm.cmd run smoke:pwa` | PWA guards | Pass |
| `npm.cmd run smoke:native` | native wrapper/session guards | Pass |
| `npm.cmd run smoke:profiles` | profile/search/shop guards | Pass |
| `npm.cmd run smoke:booking` | booking guards and input security | Pass |
| `npm.cmd run smoke:payments` | payment/checkout/merch guards | Pass |
| `npm.cmd run smoke:dm` | messaging and disposable DB contracts | Pass |
| `npm.cmd run smoke:admin` | Phase 8 admin suite and disposable DB contracts | Pass |
| `npm.cmd run smoke:security` | security guards | Pass |
| `npm.cmd run test:search-visibility` | search privacy contract | Pass |
| `npm.cmd run test:search-discovery-contract` | search discovery contract | Pass |
| `npm.cmd run test:messaging-notifications` | messaging/notifications and disposable DB contracts | Pass |
| `npm.cmd run test:booking-lifecycle-db` | booking disposable DB contracts | Pass |
| `npm.cmd run test:booking-input-security` | booking input security | Pass |
| `npm.cmd run test:performance-reliability` | performance/reliability contracts | Pass |
| `SMOKE_MOBILE_WIDTH=360 SMOKE_MOBILE_HEIGHT=800 npm.cmd run smoke:mobile` | 360x800 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=412 SMOKE_MOBILE_HEIGHT=915 npm.cmd run smoke:mobile` | 412x915 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=768 SMOKE_MOBILE_HEIGHT=1024 npm.cmd run smoke:mobile` | 768x1024 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=820 SMOKE_MOBILE_HEIGHT=1180 npm.cmd run smoke:mobile` | 820x1180 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=1024 SMOKE_MOBILE_HEIGHT=768 npm.cmd run smoke:mobile` | 1024x768 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=1280 SMOKE_MOBILE_HEIGHT=720 npm.cmd run smoke:mobile` | 1280x720 local Edge Chromium | First run hit local resource error; rerun passed |
| `SMOKE_MOBILE_WIDTH=1440 SMOKE_MOBILE_HEIGHT=900 npm.cmd run smoke:mobile` | 1440x900 local Edge Chromium | Pass |
| `SMOKE_MOBILE_WIDTH=1920 SMOKE_MOBILE_HEIGHT=1080 npm.cmd run smoke:mobile` | 1920x1080 local Edge Chromium | Pass |

## Manual Physical-Device Checklist

Run this only with safe test accounts and synthetic media. Keep raw screenshots, videos, payment details, license documents, private DMs, account identifiers, and console logs in the ignored private handoff area.

### iPhone

- Safari portrait and landscape: login, signup, reset, Help, Search, profile, Merch, Gigs, booking, DMs, notifications, and admin denial.
- Installed PWA portrait and landscape: start URL, standalone safe areas, status bar, bottom navigation, offline shell, return online, logout/session clear, modal/lightbox, rotation.
- Keyboard: search, login, signup, booking notes, message composer, multiline and long unbroken message text.
- Camera/photo picker: avatar, banner, portfolio/media, verification evidence with synthetic file, report/support evidence, message attachment if enabled.
- Notifications: permission denied/unavailable state and notification-center fallback.

### iPad

- Safari portrait and landscape, plus split-view/narrow window if practical.
- Installed PWA portrait and landscape: safe areas, status bar, keyboard, modal/lightbox, booking, messaging, admin denial, tablet breakpoints.
- Upload/photo picker with synthetic portrait, landscape, tall, wide, unsupported, and corrupt files where each surface allows testing.
- On the exact TestFlight build after its identity is re-verified, open one privately reviewed seller link in the external browser, return to the app, and confirm no TTC payment, order, receipt, or success state appears.

### Android Phone

- Chrome portrait and landscape.
- Installed PWA: start URL, offline shell, keyboard, safe-area/bottom navigation, back-button behavior, rotation, modal/lightbox.
- Camera/photo picker and uploads with synthetic files.
- Booking, messaging, notification fallback, and admin denial.
- On the exact Google Play build after its track identity is re-verified, open one privately reviewed seller link in the external browser, return to the app, and confirm the seller disclosure remains clear with no false TTC success state.

### Android Tablet

- Chrome portrait and landscape.
- Installed PWA: tablet breakpoints, keyboard, uploads, booking, messaging, modal/lightbox, admin denial.

## Carry Forward To Phase 9

1. Two Phase 8 additive migrations require controlled release application.
2. CSP remains Report-Only unless certification explicitly approves enforcement.
3. Rate limiting remains isolate-local until a globally durable design is approved.
4. Keep `TTC_SELLER_CHECKOUT_LINKS_ENABLED=false` until the protected migration, private seller-link review, disclosure, web/Android/TestFlight iPad external-browser QA, no-false-success evidence, and gate-off rollback are separately approved.
5. Every-minute scheduled-job idempotency, overlap safety, and observability require final certification review.
6. Physical-device results must be clearly separated from browser emulation.
7. Any unresolved blocker/high-severity QA defects prevent Phase 9.

## Review Status

Phase 8.5 is ready for review from branch-local automated QA. Physical-device certification remains unverified and must be completed before Phase 9 claims that require real hardware.
