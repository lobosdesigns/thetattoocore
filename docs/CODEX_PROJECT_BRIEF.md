# TheTattooCore Codex Project Brief

## Current Repo

- Local app path: `C:\Users\lobos\Documents\Codex\Projects\thetattoocore-web`
- GitHub repo: `lobosdesigns/thetattoocore`
- Main production domain: `https://thetattoocore.com`
- Sites project is registered in `.openai/hosting.json`.

## Product Shape

TheTattooCore is an 18+ body-art community platform for tattoo artists, studios, vendors, and enthusiasts. Main surfaces are 4U, Gossip, Stuff, Gigs, Merch, DMs, Stories, public profiles, booking requests/deposits, ads, Help, Settings, and Admin.

## Current Launch Rules

- No visible nudity.
- No AI art/search claims in the member experience.
- No scratcher promotion or unsafe professional equipment access.
- Merch checkout and payment flows stay review-controlled.
- Public/support copy should use company email and avoid personal owner contact details.
- Public/member-visible copy should not expose hosting, database, storage, mail, payment-provider, API-key, or infrastructure names.

## Verification Habit

For normal web changes, run the focused guard for the touched area, then `npm.cmd run lint`, `npm.cmd run build`, deploy, and run live `smoke:public` plus `smoke:mobile`. Record successful production deploys in `docs/APP_STORE_READINESS.md`.

## Active Direction

Keep maturing toward beta/public readiness: tighten mobile layout, reduce confusing copy, keep settings/admin/profile pages sectioned, preserve fast feeds, harden DMs/bookings/Merch/payments, and keep the Help Center useful for members.
