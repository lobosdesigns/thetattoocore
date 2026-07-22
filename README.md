# TheTattooCore

TheTattooCore is being built as a social platform for the body-art community:
artists, studios, collectors, enthusiasts, vendors, conventions, and related
creative work.

## Product Notes

- The platform should emphasize real human body art. No AI art, AI search,
  AI-generated feeds, or AI-driven creator replacement features are part of the
  brand direction.
- The community should not promote unlicensed studios, unprofessional tattooing,
  unsafe scratcher activity, or tattoo equipment sales to unprofessional buyers.
- TheTattooCore should stand against corporate takeover pressure in the
  body-art industry and keep the platform centered on independent artists,
  studios, craft, culture, and ethical vendors.
- Stuff is for verified artists, studios, and approved vendors. Fans can browse
  listings, but buy, sell, trade, and seller-contact actions should require
  verified professional or vendor status.
- Vendors must be approved with proper business licensing before they receive
  marketplace transaction access.
- Ads should stay simple and transparent. Artist/client-growth ads belong in 4U
  and Gossip with goals for leads, messages, and engagement. Stuff ads belong
  only in Stuff, focused on listing views, eligible seller messages, and
  marketplace engagement.
- Photos, reels, videos, listing media, gig media, and DM attachments should
  open in a focused lightbox so people can zoom in and inspect body-art detail.
- Stories are started with photo, GIF, and short-video moments for launch.
- TheTattooCore supports freedom of body-art expression when content follows
  safety, consent, legality, and adult-content guidelines.
- Visible nudity is not allowed for launch. Members should crop or cover
  private areas before posting tattooing, piercing, scars, healing, placement,
  or body-art documentation.
- The platform should feel like a safe home for the body-art community without
  unwanted AI, spam, harassment, scams, or dangerous unprofessional practice.

## Development

```bash
npm.cmd run dev
```

## Verification

```bash
npm.cmd run verify
```

## Production Secrets

Cloudflare needs these public variables and server-only bindings for full
production behavior:

- `NEXT_PUBLIC_SITE_URL`: canonical site URL, currently `https://thetattoocore.com`.
- `NEXT_PUBLIC_SUPABASE_URL`: browser-safe Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase publishable key.
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`: browser-safe public key for future device alert setup; keep the placeholder until production delivery is enabled.
- `NEXT_PUBLIC_DEVICE_ALERT_SETUP_ENABLED`: keep `false` until device-alert delivery, tap routing, opt-out, quiet hours, and category preference evidence is complete.
- `TTC_DEVICE_ALERT_SETUP_ENABLED`: server-side native app alert UI gate; keep `false` until private app configuration and device evidence are complete.
- `TTC_NATIVE_PUSH_REGISTRATION_ENABLED`: server-only native device-registration write gate; enable only with the native UI gate during controlled device QA.
- `TTC_WEB_PUSH_REGISTRATION_ENABLED`: server-only browser subscription write gate; enable only when browser delivery is independently ready.
- `TTC_ANDROID_APP_LINK_PACKAGE_NAME`: Android package name used by the public app-link association route.
- `TTC_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS`: private deploy-time Google Play app-signing SHA-256 fingerprint list for `/.well-known/assetlinks.json`; keep the placeholder until final signing proof is ready.
- `TTC_IOS_APP_LINK_APP_IDS`: private deploy-time Apple team/app identifier list for `/.well-known/apple-app-site-association`; keep the placeholder until Associated Domains proof is ready.
- `HOSTGATOR_SMTP_PASSWORD`: required for HostGator transactional email.
- `SUPABASE_SERVICE_ROLE_KEY`: required for server-only Supabase Auth email lookup, used by verification approval/rejection emails. Never expose this as a `NEXT_PUBLIC_` variable.
- `STRIPE_SECRET_KEY`: server-only Stripe key for test/live checkout sessions.
- `STRIPE_WEBHOOK_SECRET`: server-only webhook signing secret for Stripe payment status updates.
- `STRIPE_EXPECTED_LIVEMODE`: keep `false` until live keys, live webhook events, policy review, and penny-test evidence are complete.

Keep public support and reply-to email on company mail such as
`support@thetattoocore.com`. Do not put personal owner contact details in public
app copy or store metadata.

## Native Signing And App Config

Android upload signing values are private native-build inputs, not web
production environment variables. Keep `TTC_ANDROID_UPLOAD_STORE_FILE`,
`TTC_ANDROID_UPLOAD_STORE_PASSWORD`, `TTC_ANDROID_UPLOAD_KEY_ALIAS`, and
`TTC_ANDROID_UPLOAD_KEY_PASSWORD` in the private release handoff or local build
environment only. They do not belong in `.env.example`, public docs, store
metadata, or member-facing copy.

Native app config files also stay private-build-only. Keep `google-services.json`
and `GoogleService-Info.plist` out of git; add them only in the private Android
or iOS build environment after app-store, signing, and device-evidence gates are
ready.

Verified app-link association values are deployment inputs, not committed
artifacts. The `.well-known` association routes stay unavailable until final
Android app-signing fingerprints and Apple app IDs are configured privately.

After adding or rotating secrets, redeploy with:

```bash
npm.cmd run deploy
```
