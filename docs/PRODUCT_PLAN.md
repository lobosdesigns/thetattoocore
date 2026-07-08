# TheTattooCore Product Plan

## Core Experience

- Feed: image posts and short reel clips, 40-word captions, likes, and short 40-word comments.
- Threads: longer posts, optional image, replies, likes, and community discussion.
- Marketplace: flash, guest spots, chairs, supplies, and services with seller messaging.
- Messages: integrated direct messenger for bookings, marketplace questions, and collaboration.
- Composer: one floating plus button that opens the correct posting form for the current column.

## Visual Direction

- Move toward a younger, tech-forward social app feel with more polish, motion, and energy.
- Explore a darker overall UI direction with light grey surfaces, strong contrast, and tattoo-culture edge without becoming hard to read.
- Add visual punch through tighter spacing, bolder active states, refined icon usage, tasteful shadows, and accent color moments.
- Keep the app functional first: content should remain easy to scan, controls should stay obvious, and mobile layouts should feel fast.
- Avoid a flat beige-only look; the brand should feel like a modern creative community, not a generic marketplace.

## Global Availability

- Add account-level language preference and country settings early.
- Start with manual UI language selection, then add translated UI strings.
- Later add post-level translation using a provider-backed translation service, with original text preserved.
- Avoid auto-translating tattoo terms blindly where context matters; show original text when requested.
- Support country availability by feature where local law, payments, marketplace rules, or content rules require it.

## Public, Private, And Indexable Areas

- Keep the site partly public so artists, studios, marketplace listings, public profiles, and selected public posts can be indexed by search engines.
- Keep private areas non-indexable and login-only: direct messages, account settings, admin tools, draft listings, moderation queues, and user-private profile data.
- Use an Instagram-style sharing model: public visitors can open shared links and see a limited preview, but must sign up or log in to continue deeper into the app.
- Public previews should not expose full comment threads, full profile browsing, posting tools, messaging, follower lists, or full-resolution sensitive media.
- Content marked sensitive, adult, or body-art nudity must not be visible to logged-out public visitors.
- Sensitive content requires login plus 18+ terms acceptance before it can be viewed.
- Add SEO-friendly public profile pages and public listing pages, while respecting profile privacy controls.
- Add `robots.txt`, metadata, and per-route noindex rules before launch.
- Do not expose private messages, private account data, unpublished content, or sensitive/adult content to crawlers.

## Age And Content Policy

- TheTattooCore is planned as an 18+ community.
- Add an age gate during signup requiring users to confirm they are 18 or older.
- Store the user's 18+ self-attestation and terms acceptance timestamp on the profile.
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
  - Artist/studio verified: required manual review for artist and studio accounts before they receive a verified artist/studio badge.
  - Artist/studio license verified: artists and studios must submit licensing or certification documentation showing they are legally allowed to tattoo or operate in their jurisdiction.
  - Advertiser verified: billing and campaign review before ads go live.
- Artist/studio license documents must be private, stored outside public media buckets, visible only to the submitting user and authorized admins/moderators.
- Verification review should collect license/certification file, issuing region, license or certification name/number where applicable, expiration date when applicable, and reviewer notes.
- Profiles should show verification badges only after approval; rejected or pending verification should not be public-facing.
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

- Gigs: jobs, conventions, guest spots, shop openings, apprenticeships, and event opportunities for artists and studios.
- Contests: artist contests, flash challenges, sponsor prizes, and voting.
- Streams: live tattoo sessions, shop walkthroughs, Q&A, and moderated chat.
