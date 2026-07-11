# TheTattooCore Product Plan

## Core Experience

- Feed: image posts and short reel clips, 40-word captions, likes, short 40-word comments, comment likes, and comment replies. Comment likes/replies are live for launch, including visible replies.
- Threads: longer posts, optional image, replies, likes, comment likes, and community discussion. Comment likes/replies are live for launch, including visible replies.
- Comments: original authors must be able to edit/delete their own comments and replies. Post/thread owners should be able to hide/delete/block disruptive comments on their own posts, and all signed-in users should be able to report comments. These controls must appear wherever comments are rendered, including 4U/Gossip cards, detail pages, opened notifications, and deep-link contexts. Done for launch on home cards and 4U/Gossip detail pages, with compact styled controls on detail pages.
- Marketplace/Stuff: verified artists, studios, and vendors can buy, sell, and trade approved body-art goods and services; fans can browse but not transact or contact sellers.
- Merch: a separate public-buyable marketplace for artist, studio, vendor, and TheTattooCore merchandise such as T-shirts, prints, art, stickers, aftercare-adjacent brand goods, and other safe fan-facing products. Merch should not be mixed with pro Stuff because the general public can buy Merch, while Stuff stays verification-gated.
- Messages: integrated direct messenger for bookings, marketplace questions, and collaboration.
- DMs need a focused test pass with the regular test user and moderator test user before app submission. Mobile inbox/thread routing, read-state clearing, signed attachment display, direct thread read markers, notification deep-link routing, and realtime refresh subscriptions for message/photo inserts are improved for launch; real send/receive testing still needs logged-in test sessions.
- Notifications: in-app alerts and unread badges first, important email second, PWA browser push third, then native APNs/FCM push for iOS and Android apps.
- Composer: one floating plus button that opens the correct posting form for the current column.
- Main column swiping should snap one column at a time. A horizontal swipe should land on the next column and stop instead of sliding quickly across multiple sections. Done for launch with a controlled mobile snap rail.
- Column order for launch planning is 4U, Gossip, Stuff, Gigs, Merch, then DM. Merch can stay as a planned placeholder until seller approval, checkout, tax, shipping, refunds, and payment-provider rules are built.
- Long feeds and queues should load 25 items at a time with a clear Load more button for each next batch of 25. Apply this to 4U, Gossip, Stuff, Gigs, Merch, notifications, saved items, search results, comments/replies, admin queues, and future long lists so the site stays fast as volume grows. Done for launch on the home 4U, Gossip, Stuff, Gigs, notifications, saved items, search results, DM inbox, and 4U/Gossip detail comments, with follower/following and dedicated admin queues using 50-item page navigation.
- Admin queues should get per-tab Load more controls after the simple 25-item caps are stable, so verification, reports, users, ads, data requests, media review, and activity logs can scale without returning to one giant admin page. Dedicated admin queue pages now use 50-item page navigation where real queues exist.
- Admin sections must become dedicated pages as volume grows, especially Users, Ads, Stuff, Merch, Reports, Verification, Data Requests, Content, Gigs, Media Ops, and Mail Settings. Each long admin list should use real pagination instead of an endless dashboard section; Users, Ads, Data Requests, Verification, Reports, Content, Stuff, Gigs, Mail Settings, Media Ops, and a Merch planning page have started with dedicated page layers.
- Admin `/admin` must stay an overview-only command center: high-level counts, health/status cards, and links into dedicated admin pages. It should not contain full user, report, verification, ad, Stuff, Merch, Gig, content, mail, or data-request queues because those pages will get long over time. Done for launch with short overview cards, recent activity, and dedicated queue links.
- Search and Saved should mention Merch as planned/coming soon until products, seller approval, checkout, tax, shipping, refunds, and payment-provider rules are built. Done for launch.
- Mobile composer: posting cards must fit mobile browser screens, scroll to the publish button, and keep advanced fields behind expandable sections. Done for launch.
- Composer uploads should not show a sensitive-content option during launch; visible nudity is not allowed, so members must crop or cover private areas before posting.
- Profiles need avatar/profile-photo upload with client-side image optimization, public display on profile pages, and rollout into feeds, comments, DMs, search, notifications, and detail pages. Done for launch, including 4U/Gossip detail comments.
- Reporting: report controls should look like a small intentional action, then open a separate report card or dropdown so users do not confuse it with normal post options. Done for launch with a labeled Flag + Report trigger and inline report form.
- Mobile report menus must stay inside the viewport; three-dot report cards in 4U, Gossip, Stuff, Gigs, and profiles should not open off-screen on narrow browsers. Done for launch by using an inline report panel.
- Report triggers should be labeled enough to reduce false taps; icon-only menus are acceptable only when the surrounding UI makes the report purpose unmistakable. Done for launch with a Flag + Report trigger.
- Comments and DMs: add richer expression over time, including emoji, GIFs, photo attachments, and simple media attachments in direct messages.
- DM compose should stay compact on mobile: text and send first, optional photo attachment behind a clear expandable control, with emoji shortcuts and visible length feedback. Done for launch.
- Photos, feed media, reels, listing media, gig media, and DM attachments should be tappable/clickable and open in an Instagram-style lightbox with zoom for images and focused playback for videos. Done for launch.
- Lightbox controls should reset cleanly between opens, support Escape/backdrop closing, and explain zoom or playback behavior without cluttering the feed. Done for launch.
- Stories: add temporary story posts later for artists, studios, vendors, events, and community moments after the core feed, Gossip, Stuff, Gigs, and DMs are stable.

## Notification Roadmap

- Keep the MVP notification system in-app first: unread badges, notification center, DMs, new followers, follow requests, comments, likes, verification decisions, Stuff seller messages, and Gigs activity. New follower, follow request, follow approval, message, comment, like, and verification decision notifications are ready for launch.
- Store notification preferences on the profile now so the same choices can later control email, web push, and native push. Done for launch with saved category preferences.
- Store quiet hours, notification timezone, important-email preference, and push opt-in intent before turning on email/web/native push channels. Done for launch as saved account settings and notification-center summaries.
- Add transactional email only for important account, verification, security, and marketplace/gig events before adding noisy social email. Started with account deletion request confirmations; verification-decision email is wired through a server-only Supabase Auth admin lookup and will send once `SUPABASE_SERVICE_ROLE_KEY` is configured in Cloudflare. Admin Mail Settings now shows whether that lookup secret is present.
- Add PWA web push after the app is installable and core flows are stable; Android and desktop Chrome are the easiest starting path, while iPhone installed-PWA push has more limits.
- Add installability before push: web app manifest, app icon, standalone display, mobile theme color, and shortcuts for 4U, DMs, and alerts. Done for launch.
- Suppress automatic mobile browser install prompts during normal browsing because the bottom install sheet can interfere with feed scrolling; add a deliberate install action later from account/settings or onboarding. Done for launch with root-level `beforeinstallprompt` suppression and an intentional Account > Notifications install button when the browser supports installation.
- Add native app push after mobile app builds exist: APNs for iOS and Firebase Cloud Messaging for Android.
- Later store push device tokens separately from profile preferences, with per-device opt-out, token revocation, and no plaintext secrets in the public client.
- Push should respect quiet hours and category preferences before launch so the app does not feel spammy. Started with a shared notification preference helper for in-app category filtering and quiet-hour checks that future email/web/native push delivery can reuse.

## Platform Stance

- TheTattooCore should openly emphasize that it does not use AI-generated art, AI search, AI feeds, or AI-driven creator replacement features.
- Keep the platform centered on real body-art artists, studios, collectors, vendors, and enthusiasts.
- Stand against corporate takeover pressure in the tattoo and body-art industry; keep the community focused on independent artists, studios, craft, culture, and ethical vendors.
- Do not promote or normalize unprofessional tattooing, unlicensed studios, or unsafe "scratcher" activity.
- Marketplace rules should prevent sales of tattoo equipment to unlicensed or unprofessional buyers where the platform can reasonably enforce it.
- Stuff access rules should allow public/fan browsing but restrict buy, sell, trade, and seller-contact actions to verified artists, studios, and vendors. Done for launch.
- Stuff UI copy should explicitly call out tattoo machines, needles, pigments, tubes, and professional shop gear as verified-only activity so fans understand browse-only access. Done for launch.
- Merch rules should allow public fan purchases of safe brand goods while still requiring seller approval for artists, studios, vendors, and official TheTattooCore store inventory.
- Merch must stay separate from professional equipment, regulated services, unsafe products, counterfeit goods, adult sexual products, and anything that would undermine app-store or payment-provider safety.
- Support freedom of body-art expression and avoid unnecessary censorship when content follows safety, consent, legality, and adult-content guidelines.
- Draw firm safety lines around pornography, sexualized content, exploitation, minors, harassment, scams, unsafe practices, and content showing unprofessional or potentially deadly harm.
- Position the community as a safe space for body-art culture to express itself without unwanted AI, spam, or unprofessional practice watering it down.
- Blocking should hide profile content from the blocker, remove follow relationships, and prevent new DMs in either direction. Done for launch.
- Launch trust surfaces should repeat these values in user-facing places, including `/login`, `/terms`, `/privacy`, account verification, and account advertising settings. Done for launch, including front-door no-AI, no-scratchers, verified Stuff, and independent-community positioning.

## Visual Direction

- Move toward a younger, tech-forward social app feel with more polish, motion, and energy.
- Explore a darker overall UI direction with light grey surfaces, strong contrast, and tattoo-culture edge without becoming hard to read.
- Add visual punch through tighter spacing, bolder active states, refined icon usage, tasteful shadows, and accent color moments.
- Keep the app functional first: content should remain easy to scan, controls should stay obvious, and mobile layouts should feel fast.
- Avoid a flat beige-only look; the brand should feel like a modern creative community, not a generic marketplace.
- Continue pushing the app toward a sleeker, darker, higher-contrast social look with more pop, sharper mobile controls, and a stronger younger-crowd feel.
- Add more tech-forward polish across the app: layered opacity, stronger card borders, cleaner shadows, darker chrome, sharper active states, and less plain beige surface area. Started with global font, card-rim, grid-line, and shadow refinements.
- Add user-selectable appearance settings for Light, Dark, and System mode. Started for launch with instant local switching plus profile-stored preference for signed-in users; theme-token migration has begun on appearance controls, main column tabs, language cue, account/profile surfaces, DM shells, DM inbox/thread controls, notification list surfaces, Saved, Search, auth/login screens, 4U/Gossip detail pages, Stuff/Gigs detail pages, public policy/support pages, follower/following lists, public profile surfaces, composer modal controls, report controls, media upload controls, media lightbox, word/emoji field controls, profile/license form controls, account settings shell/cards, install/share controls, notification icon, sensitive-content gate, admin overview, admin mail settings, admin users pagination/controls, admin content/report moderation pages, admin Stuff/Gigs/Merch pages, admin ads review pages, and admin verification/data/media ops pages so both modes can become polished instead of just inverted.
- Notifications and admin need another mobile responsive pass; no panels, buttons, or cards should drift out of frame on narrow browser viewports. Notifications received another mobile containment pass for launch.
- Admin should move away from one long cluttered page toward clearer tab/menu sections for Overview, Verification, Reports, Users, Ads, Data, Media, and Mail. Done for launch with a compact admin overview and dedicated pages for each major queue.
- Account/profile editing should follow the same tabbed cleanup direction as admin so profile, language, privacy, notifications, verification, ads, and data do not feel like one long cluttered scroll. Started for launch with sticky account tabs, tabbed profile sub-sections, and theme-token form/card styling on the core profile editor.
- The 4U language preference notice should default to English but behave like a light onboarding cue: hide after the first real interaction such as tap, click, scroll, or swipe. Done for launch with local dismissal and explicit swipe dismissal.

## Global Availability

- Add account-level language preference and country settings early. Done for launch.
- Start with manual UI language selection, then add translated UI strings. Started for launch with stored language preference and document language signals.
- Expand launch country/language options conservatively while keeping manual selection simple and reversible. Done for launch with approved country/language lists shared by account and ad forms.
- Later add post-level translation using a provider-backed translation service, with original text preserved.
- Avoid auto-translating tattoo terms blindly where context matters; show original text when requested.
- Support country availability by feature where local law, payments, marketplace rules, or content rules require it.

## Public, Private, And Indexable Areas

- Keep the site partly public so artists, studios, marketplace listings, public profiles, and selected public posts can be indexed by search engines.
- Keep private areas non-indexable and login-only: direct messages, account settings, admin tools, draft listings, moderation queues, and user-private profile data.
- Use an Instagram-style sharing model: public visitors can open shared links and see a limited preview, but must sign up or log in to continue deeper into the app.
- Use `/login` as the default logged-out landing page, while shared public content links can still open limited previews when allowed.
- Shared links should include Open Graph/Twitter card metadata so non-sensitive posts can show the real image, title, and short subtext on Facebook, X, texts, and other social previews. Done for launch on 4U, Gossip, Stuff, Gigs, and profiles.
- Legacy or admin-marked sensitive links must not expose the media in social previews; use the site logo/brand card as the share image instead. Done for launch with shield fallback metadata.
- If legacy or admin-marked sensitive shared content exists, logged-out visitors should see a blurred/locked preview with a sign-in prompt.
- If a signed-in user has not accepted the adult body-art terms yet, legacy or admin-marked sensitive shared content should ask for 18+ confirmation instead of telling them to sign in again.
- Main app feeds should keep any legacy or admin-marked sensitive posts visible only as blurred, non-clickable media with locked captions/comments until the viewer signs in and confirms 18+.
- Locked sensitive previews should use brand-safe placeholders and must not load the underlying full media URL for logged-out or non-confirmed viewers. Done for launch on 4U, Gossip, Stuff, and Gigs detail views.
- Public previews should not expose full comment threads, full profile browsing, posting tools, messaging, follower lists, or full-resolution sensitive media. Done for launch: logged-out visitors see limited counts/previews and must sign in for comments, follower lists, posting, DMs, saves, and reports.
- Profile and site-level share metadata should include brand-safe image alt text; public profile cards can use public non-sensitive work, while private profiles use the brand shield. Done for launch.
- Content marked sensitive or adult by legacy data or admin moderation must not be visible to logged-out public visitors.
- Sensitive-content handling remains available for legacy/admin moderation, but member upload forms should default new content to non-sensitive during the no-visible-nudity launch policy.
- Add SEO-friendly public profile pages and public listing pages, while respecting profile privacy controls.
- Add `robots.txt`, metadata, and per-route noindex rules before launch. Done for launch with private route disallows/noindex metadata and sitemap entries limited to public-safe profiles, posts, Gossip, Stuff, Gigs, and support/legal pages.
- Do not expose private messages, private account data, unpublished content, or sensitive/adult content to crawlers. Done for launch with private route noindex and sitemap filtering for public, active, non-sensitive content.
- Provide a public support URL for app-store review, safety reports, privacy help, and account deletion instructions. Done for launch at `/support`.
- Keep account deletion requests in an admin data-request queue during launch; complete irreversible deletion manually until legal hold and retention rules are final. Done for launch with Account > Data requests, email confirmation when SMTP is enabled, and the admin data-request queue.

## Age And Content Policy

- TheTattooCore is planned as an 18+ community. Done for launch in signup, profile setup, terms, and support copy.
- Add an age gate during signup requiring users to confirm they are 18 or older. Done for launch.
- Store the user's 18+ self-attestation and terms acceptance timestamp on the profile. Done for launch.
- Keep signup blocked until the user explicitly confirms 18+. Done for launch.
- Launch with a no-visible-nudity policy for app-store readiness and lower moderation risk, even when the intent is tattoo, piercing, scar, healing, placement, or body-art documentation. Done for launch in upload copy and policy pages.
- Require members to crop or cover private areas before posting; revisit any body-art nudity policy only after moderation, app policy, and legal review are mature.
- Prohibit pornography, sexual solicitation, explicit sexual content, exploitative content, and content involving minors in nudity or sexualized contexts.
- Do not ask members to self-label uploads as sensitive during launch; moderation can still hide or restrict edge-case content if needed. Done for launch.
- Add moderator tools for hiding, warning, removing, and escalating content. Started for launch with admin report/content queues, under-review, hidden, removed, and restored statuses; dedicated warning/escalation workflow can be refined later.
- Add report reasons for nudity, sexual content, sensitive non-nude body-art context, minors, harassment, scams, unsafe practices, and illegal goods/services. Done for launch.

## Verification

- Start with free/low-cost verification: confirmed email, 18+ self-attestation, profile completeness, and optional manual artist/shop review. Done for launch with email confirmation, profile readiness checks, 18+ account gates, and manual artist/studio/vendor license review.
- Add public verification badges later for artists, studios, vendors, and advertisers. Started for launch for license-verified artists, studios, and vendors.
- Verification levels:
  - Email verified: user confirmed email address.
  - Profile verified: profile has enough identity/location/business info to reduce spam.
  - Artist/studio/vendor verified: required manual review before they receive a verified badge or Stuff transaction access.
  - Artist/studio/vendor license verified: artists and studios must submit licensing or certification documentation showing they are legally allowed to tattoo or operate in their jurisdiction; vendors must submit proper business licensing before approval.
  - Advertiser verified: billing and campaign review before ads go live.
- Artist/studio/vendor license documents must be private, stored outside public media buckets, visible only to the submitting user and authorized admins/moderators.
- Verification review should collect license/certification or business-license file, issuing region, license or certification name/number where applicable, expiration date when applicable, and reviewer notes. Done for launch.
- Verification approvals must be server-checked for eligible account type and non-expired documents; rejections should require a useful reviewer note for the member. Done for launch.
- Account verification history should show private reviewer notes, pending status, expiration status, and resubmission guidance without exposing license documents publicly. Done for launch.
- Account and app surfaces should show a clear readiness summary for profile setup, 18+ status, verification status, account standing, and Stuff access. Done for launch.
- Profiles should show verification badges only after approval; rejected or pending verification should not be public-facing. Done for launch.
- SMS or phone MFA is not the default starting path because it adds cost. Current Supabase phone MFA is a paid add-on and SMS/WhatsApp messages can add provider charges.
- Revisit SMS/phone verification only when there is a clear anti-spam need and budget for it.

## Location And Discovery

- Store user-selected city, region, country code, and language preference. Done for launch.
- Ask before using precise browser geolocation. Done for launch by not requesting browser GPS yet and documenting typed/coarse location only.
- Keep coarse typed location useful without making precise device GPS a requirement for the basic social app. Done for launch.
- Use coarse location first for marketplace discovery, event/contest filtering, and ads.
- Keep location personalization opt-in/out visible in account settings.

## Media Pipeline

- Add client-side image optimization early so large phone photos are resized and compressed before upload. Done for launch.
- Add profile-photo uploads using the same optimization-first approach, with smaller avatar limits than feed media. Done for launch.
- Keep generous but real upload limits to prevent runaway storage, bandwidth, moderation, and abuse costs. Done for launch with optimized image limits and strict raw-video caps.
- Start with image compression to Web-friendly JPEG/WebP dimensions, around 1600-2200px max edge for feed media and smaller generated previews where needed. Done for launch with browser WebP resizing up to 2200px.
- Preserve enough image quality for tattoo detail while avoiding full-resolution camera originals in normal feed delivery.
- Normal feeds can use optimized display media, while the lightbox should preserve enough detail for users to inspect linework, healed texture, placement, and product condition.
- Keep original-file storage optional for later verified artists or paid creator tools, not as the default MVP path.
- Start video with short 1-minute reel limits and clear file-size caps. Done for launch with 60-second and 50 MB caps.
- Treat Cloudflare Stream as the preferred production video route once usage grows, because it handles encoding, adaptive playback, thumbnails, and delivery better than raw Storage video.
- Revisit a DIY FFmpeg/R2 pipeline only if video volume makes managed video too expensive.
- User-facing upload copy should make it clear that images are optimized now, while videos stay capped and raw until the managed video pipeline is worth enabling. Done for launch.

## Lightweight Ads

- Build a simple internal ad rotator before any complex ad platform.
- Targeting inputs: country, region, city, language, tattoo style keywords, marketplace category, and column placement.
- Ad country and language targeting should use the same approved account option lists so advertisers do not submit invalid raw codes. Done for launch.
- Buying model: fixed daily budget plus optional spot bidding for placements.
- Placements: feed card, thread sidebar/card, marketplace card, and messages-safe non-invasive placement.
- Artist/client-growth ads should run in 4U and Gossip only, with goals for leads, messages, and engagement.
- Artist ads should appear in randomized bidded spots inside 4U and Gossip, clearly labeled as sponsored.
- Stuff ads should run only inside Stuff, using the same simple bidding and rotation model but never leaking into 4U or Gossip.
- Stuff ad goals should focus on listing views, seller messages from eligible users, and marketplace engagement.
- Merch ads should run only inside Merch or safe brand placements and focus on product views, shop visits, and public purchases without mixing with professional Stuff equipment campaigns.
- Safety rules: no sensitive personal targeting, no hidden behavioral profiling, no adult/minor targeting, and clear sponsor labels.
- Privacy language should also reject AI ad expansion, opaque lookalike-style automation, and confusing ad targeting that members cannot understand.
- Sponsored cards should show clear ad labeling plus simple relevance context such as placement, coarse location, language, or keywords. Started for launch with reviewed sponsored cards showing placement, country/language labels, keywords, and no-AI-profiling copy.
- Admin review should explicitly reject AI tattoo art claims, unsafe scratcher promotion, unlicensed studio promotion, and restricted equipment ads. Done for launch with visible admin ad-review standards.
- Advertiser flow: create campaign, upload creative, choose regions/languages/keywords, set bid/budget, submit for admin review. Started for launch with account campaign submission, simple targeting, placements, bid/budget, and admin review.
- Admin flow: approve/reject campaigns, pause campaigns, inspect spend/impressions/clicks, and moderate creative. Started for launch with dedicated admin ad queue, review standards, status actions, and basic performance counts.

## Later Columns

- Merch: artist, studio, vendor, and TheTattooCore merchandise for public fan purchases, including T-shirts, prints, art, stickers, and other safe brand goods.
- Gigs: jobs, conventions, guest spots, shop openings, apprenticeships, and event opportunities for artists and studios.
- Contests: artist contests, flash challenges, sponsor prizes, and voting.
- Streams: live tattoo sessions, shop walkthroughs, Q&A, and moderated chat.
