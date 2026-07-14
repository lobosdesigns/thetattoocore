# Native Wrapper Prep

Use this before creating Android or iOS wrapper projects. The goal is a thin, policy-safe app shell around the production web app, not a separate native product with duplicated business logic.

## App Shell Position

- Start URL: `https://thetattoocore.com/login`.
- Keep shared links, support, privacy, terms, account deletion, and public content previews on `thetattoocore.com`.
- Keep server-side auth, moderation, payments, mail, storage, verification, and admin workflows on the web app.
- Do not place private API keys, service-role keys, payment secrets, mail credentials, admin credentials, or database credentials in native code.
- Do not add broad native permissions just because the app is wrapped. Add permissions only when a tested feature requires them.

## Allowed Navigation

- Allow `https://thetattoocore.com` and same-origin app routes.
- Allow hosted checkout only through the current checkout flow, then return to safe internal app routes.
- Allow support, privacy, terms, account deletion instructions, and public shared content routes.
- Block or open externally any unexpected third-party destinations.
- Keep all login return paths internal and reject protocol-relative or external return paths.

## Native Permissions

- Camera: do not request at wrapper launch unless a native camera bridge is deliberately added.
- Photo library / media picker: prefer normal browser file inputs first.
- Location: do not request precise device location at launch; typed city/region/country remains the default.
- Push notifications: do not prompt on first open. Ask only after notification preferences and device-token delivery are ready.
- Microphone: do not request at launch.
- Contacts: do not request at launch.

## Store Review Safety

- The app remains 18+.
- Visible nudity is not allowed for launch.
- User-generated content, reporting, blocking, moderation, DMs, public previews, marketplace/commerce limits, and account deletion must match the public Terms, Privacy, and Support pages.
- Store screenshots must follow `docs/SCREENSHOT_PREP.md`.
- Data Safety and App Privacy answers must be checked against `docs/DATA_SAFETY_PREP.md`.
- Age-rating answers must be checked against `docs/AGE_RATING_PREP.md`.
- Real payments, seller payouts, taxes, shipping, refunds, disputes, and app-store commerce rules must pass `docs/PAYMENT_PRODUCTION_READINESS.md` before production commerce is promoted in native builds.

## QA Before Internal Testing

- Run `npm.cmd run verify` against the web app.
- Run the full `docs/REAL_DEVICE_QA_CHECKLIST.md` on mobile web before packaging.
- Confirm `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/support`, `/privacy`, `/terms`, `/messages`, `/notifications`, `/account`, public profiles, public posts, Stories, Stuff, Gigs, Merch, and booking/deposit routes do not reload-loop or overflow horizontally.
- Confirm install prompts or browser banners do not block scrolling in the wrapper.
- Confirm videos do not show a visible download control in the wrapper media player.
- Confirm file uploads work through normal mobile file pickers.
- Confirm hosted checkout returns safely to the app and does not expose raw payment or payout credentials in app forms.

## First Wrapper Steps

1. Create the wrapper in a separate native app folder after mobile web QA is stable.
2. Point the wrapper to `/login`.
3. Reuse TTC shield icons, maskable icon, splash, and store screenshots.
4. Configure app links/universal links for public profile, post, Story, Gossip, Stuff, Gigs, Merch, booking, support, privacy, and terms routes.
5. Keep native permissions minimal.
6. Run Android internal testing and TestFlight before public submission.
7. Re-run real-device QA after every wrapper permission, deep-link, checkout, push, or upload change.
