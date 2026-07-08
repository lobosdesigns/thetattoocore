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
