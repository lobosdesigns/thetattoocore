# Store Screenshot Inventory

Current generated safe screenshots:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-login-signup.png`
- `public/screenshots/mobile-4u-safe.png`
- `public/screenshots/mobile-stories-safe.png`
- `public/screenshots/mobile-gossip-safe.png`
- `public/screenshots/mobile-profile-search.png`
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
  are 2048 x 2732 PNG files with no alpha channel.

These generated placeholders are TTC-branded, rights-safe, and show the current
main content columns: 4U, Gossip, Stuff, Gigs, and Merch. DM should appear as a
direct messenger shortcut, not as a main swipe/feed column.

Still needed before public store review:

- Replace generated placeholders with final real-device screenshots after
  mobile QA, using safe sample accounts and rights-cleared non-sensitive media.
- Replace generated tablet placeholders with final real-device iPad captures if
  the native iPad layout changes before public review.
- Merch guide shortcut screenshot showing where sellers can find setup help,
  without showing seller payout setup details.

Rules:

- Do not show private DMs, admin queues, license documents, real payment data, real personal contact details, copyrighted tattoo art, visible nudity, or infrastructure/provider names.
- Use final support/legal copy before capturing public review screenshots.
- Help/Support screenshots must show public guide content only, not private order details, seller payout setup details, support tickets, or moderation queues.
- Re-run mobile QA after screenshots are captured so the images match the submitted build.
