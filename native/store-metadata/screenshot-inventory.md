# Store Screenshot Inventory

Current generated safe screenshots:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-login-signup.png`
- `public/screenshots/mobile-4u-safe.png`
- `public/screenshots/mobile-stories-safe.png`
- `public/screenshots/mobile-gossip-safe.png`
- `public/screenshots/mobile-profile-search.png`
- `public/screenshots/mobile-verification-safe.png`
- `public/screenshots/mobile-booking-safe.png`
- `public/screenshots/mobile-ads-safe.png`
- `public/screenshots/mobile-merch-safe.png`
- `public/screenshots/mobile-merch-help-shortcut-safe.png`
- `public/screenshots/mobile-payout-safe.png`
- `public/screenshots/mobile-order-support-safe.png`
- `public/screenshots/mobile-privacy-safety-safe.png`
- `public/screenshots/mobile-help-support.png`
- `public/screenshots/desktop-home.png`

Upload-ready derivatives generated from the safe mobile set:

- Google Play phone screenshots:
  `native/store-metadata/generated/google-play/phone-screenshots/*-1080x1920.png`
  are 1080 x 1920 PNG files with no alpha channel.
- Google Play feature graphic:
  `native/store-metadata/generated/google-play/feature-graphic-1024x500.png`
  is a 1024 x 500 PNG file with no alpha channel.
- App Store iPhone 6.5-inch screenshots:
  `native/store-metadata/generated/apple-app-store/iphone-6-5/*-1242x2688.png`
  are 1242 x 2688 PNG files with no alpha channel.
- App Store 13-inch iPad screenshots:
  `native/store-metadata/generated/apple-app-store/ipad-13/*-2048x2732.png`
  are 3 upload-ready 2048 x 2732 PNG files with no alpha channel. Apple also
  accepts 2064 x 2752 portrait files for the current 13-inch iPad class; record
  the accepted size used in the private upload validation packet.

The store metadata smoke guard validates the generated Play phone screenshots,
Play feature graphic, App Store iPhone 6.5-inch screenshots, and App Store
13-inch iPad screenshots by reading each PNG header and confirming count,
expected safe-scene filenames, dimensions, and no-alpha output.

## Upload-Selected Screenshot Sets

Current Google Play phone cap: 4 to 8 screenshots. Use this 8-file selected
set from the generated safe pool for the first Play Console upload attempt:
Current Google Play phone upload size cap: 8 MB per screenshot.

- `mobile-home-1080x1920.png`
- `mobile-login-signup-1080x1920.png`
- `mobile-4u-safe-1080x1920.png`
- `mobile-gossip-safe-1080x1920.png`
- `mobile-stories-safe-1080x1920.png`
- `mobile-profile-search-1080x1920.png`
- `mobile-privacy-safety-safe-1080x1920.png`
- `mobile-help-support-1080x1920.png`

Current App Store screenshot cap: 1 to 10 screenshots per display/localization.
Use this 10-file selected iPhone 6.5-inch set from the generated safe pool for
the first App Store Connect upload validation attempt:

- `mobile-home-1242x2688.png`
- `mobile-login-signup-1242x2688.png`
- `mobile-4u-safe-1242x2688.png`
- `mobile-gossip-safe-1242x2688.png`
- `mobile-stories-safe-1242x2688.png`
- `mobile-profile-search-1242x2688.png`
- `mobile-verification-safe-1242x2688.png`
- `mobile-booking-safe-1242x2688.png`
- `mobile-privacy-safety-safe-1242x2688.png`
- `mobile-help-support-1242x2688.png`

App Store Connect accepted this 3-file selected 13-inch iPad set from the
generated safe pool for submitted iOS build `1.0 (3)`:

- `mobile-home-2048x2732.png`
- `mobile-login-signup-2048x2732.png`
- `mobile-4u-safe-2048x2732.png`

Keep rejected-upload screenshots, console validation errors, and final
replacement decisions in the private release handoff only.

## Console Upload Validation Packet

Create one private packet for each store asset set before public review:

- Google Play phone screenshots
- Google Play feature graphic
- App Store iPhone 6.5-inch screenshots
- App Store 13-inch iPad screenshots

Each packet should record only repo-safe summary values in this file or
`docs/APP_STORE_READINESS.md`: asset set, selected build or release track,
uploaded filenames, upload validation result, final action owner, and pass/fail
status. Keep raw console screenshots, rejection text that contains account
details, private reviewer credentials, contact phone details, device identifiers,
and dashboard IDs in the private release handoff only.

Before marking a set `validated`, confirm the exact uploaded files match the
selected generated or real-device capture set, dimensions match the store class,
PNG files have no alpha channel, file sizes are within the store limit, visible
copy has no private DMs, license documents, real payment data, visible nudity,
or infrastructure/provider names, and the screenshots still match the selected
build after metadata, privacy, age-rating, and payment-status edits.

## Screenshot Replacement Status

| Store asset set | Current repo asset | Final public-review requirement | Status |
| --- | --- | --- | --- |
| Google Play phone screenshots | Generated safe phone derivatives, 15 PNGs, 1080 x 1920, no alpha. | Replace or confirm with real Android internal-test captures for the selected release track and version. | Safe draft only; not submission-ready until real-device capture and Play Console upload validation are recorded privately. |
| Google Play feature graphic | Generated TTC-branded 1024 x 500 PNG, no alpha. | Confirm final rights-safe feature graphic uploads without private member, payment, or console details. | Safe draft only; not submission-ready until Play Console feature-graphic validation is recorded privately. |
| App Store iPhone 6.5-inch screenshots | Generated safe iPhone derivatives, 15 PNGs, 1242 x 2688, no alpha. | Use only as replacement candidates; keep the submitted console set unless final real-device review requires a replacement. | App Store Connect accepted an iPhone set for submitted build `1.0 (3)`; exact mapping to these generated files and final real-device confirmation remain unverified privately. |
| App Store 13-inch iPad screenshots | Generated safe iPad derivatives, 3 PNGs, 2048 x 2732, no alpha; 2064 x 2752 is also accepted by the current 13-inch iPad class. | Keep the accepted console set tied to submitted build `1.0 (3)` and replace it only if final real-device review finds a mismatch. | App Store Connect accepted this set for submitted build `1.0 (3)`; final real-device iPad capture confirmation remains pending privately. |

These generated draft assets are TTC-branded, rights-safe, and show the current
main content columns and tutorial surfaces: 4U, Gossip, Stuff, Gigs, Merch,
verification, booking, privacy/safety, Help, and Support. DM should appear as a
direct messenger shortcut, not as a main swipe/feed column.
Merch guide shortcut screenshot is covered by
`public/screenshots/mobile-merch-help-shortcut-safe.png` without showing private
seller payout setup details.

Still needed before final evidence closure or any replacement submission:

- Replace generated draft assets with final real-device screenshots after
  mobile QA, using safe sample accounts and rights-cleared non-sensitive media.
- Replace generated tablet draft assets with final real-device iPad captures if
  the native iPad layout changes before public review.

Rules:

- Do not show private DMs, admin queues, license documents, real payment data, real personal contact details, copyrighted tattoo art, visible nudity, or infrastructure/provider names.
- Use final support/legal copy before capturing public review screenshots.
- Help/Support screenshots must show public guide content only, not private order details, seller payout setup details, support tickets, or moderation queues.
- Re-run mobile QA after screenshots are captured so the images match the submitted build.
