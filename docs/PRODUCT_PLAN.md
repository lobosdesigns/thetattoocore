# TheTattooCore Product Plan

## Core Experience

- Feed: image posts and short reel clips, 40-word captions, likes, and short 40-word comments.
- Threads: longer posts, optional image, replies, likes, and community discussion.
- Marketplace: flash, guest spots, chairs, supplies, and services with seller messaging.
- Messages: integrated direct messenger for bookings, marketplace questions, and collaboration.
- Composer: one floating plus button that opens the correct posting form for the current column.

## Global Availability

- Add account-level language preference and country settings early.
- Start with manual UI language selection, then add translated UI strings.
- Later add post-level translation using a provider-backed translation service, with original text preserved.
- Avoid auto-translating tattoo terms blindly where context matters; show original text when requested.
- Support country availability by feature where local law, payments, marketplace rules, or content rules require it.

## Public, Private, And Indexable Areas

- Keep the site partly public so artists, studios, marketplace listings, public profiles, and selected public posts can be indexed by search engines.
- Keep private areas non-indexable and login-only: direct messages, account settings, admin tools, draft listings, moderation queues, and user-private profile data.
- Add SEO-friendly public profile pages and public listing pages, while respecting profile privacy controls.
- Add `robots.txt`, metadata, and per-route noindex rules before launch.
- Do not expose private messages, private account data, or unpublished content to crawlers.

## Age And Content Policy

- TheTattooCore is planned as an 18+ community.
- Add an age gate during signup requiring users to confirm they are 18 or older.
- Add Terms of Service language explaining that tattooing, piercing, and body art may involve adult bodies or limited nudity.
- Allow limited non-sexual nudity only when the purpose is clearly to display tattoos, piercings, scars, healing, placement, or body art.
- Prohibit pornography, sexual solicitation, explicit sexual content, exploitative content, and content involving minors in nudity or sexualized contexts.
- Require users to label sensitive body-art content where appropriate.
- Add moderator tools for hiding, warning, removing, and escalating content.
- Add report reasons for nudity/body-art context, sexual content, minors, harassment, scams, unsafe practices, and illegal goods/services.

## Verification

- Start with free/low-cost verification: confirmed email, 18+ self-attestation, profile completeness, and optional manual artist/shop review.
- Add public verification badges later for artists, studios, suppliers, and advertisers.
- Verification levels:
  - Email verified: user confirmed email address.
  - Profile verified: profile has enough identity/location/business info to reduce spam.
  - Artist/studio verified: manual review of portfolio, shop, license, website, social profile, or business presence.
  - Advertiser verified: billing and campaign review before ads go live.
- SMS or phone MFA is not the default starting path because it adds cost. Current Supabase phone MFA is a paid add-on and SMS/WhatsApp messages can add provider charges.
- Revisit SMS/phone verification only when there is a clear anti-spam need and budget for it.

## Location And Discovery

- Store user-selected city, region, country code, and language preference.
- Ask before using precise browser geolocation.
- Use coarse location first for marketplace discovery, event/contest filtering, and ads.
- Keep location personalization opt-in/out visible in account settings.

## Lightweight Ads

- Build a simple internal ad rotator before any complex ad platform.
- Targeting inputs: country, region, city, language, tattoo style keywords, marketplace category, and column placement.
- Buying model: fixed daily budget plus optional spot bidding for placements.
- Placements: feed card, thread sidebar/card, marketplace card, and messages-safe non-invasive placement.
- Safety rules: no sensitive personal targeting, no hidden behavioral profiling, no adult/minor targeting, and clear sponsor labels.
- Advertiser flow: create campaign, upload creative, choose regions/languages/keywords, set bid/budget, submit for admin review.
- Admin flow: approve/reject campaigns, pause campaigns, inspect spend/impressions/clicks, and moderate creative.

## Later Columns

- Contests: artist contests, flash challenges, sponsor prizes, and voting.
- Streams: live tattoo sessions, shop walkthroughs, Q&A, and moderated chat.
