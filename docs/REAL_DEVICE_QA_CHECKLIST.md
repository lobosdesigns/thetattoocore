# Real Device QA Checklist

Use this before native wrapper work, Google Play internal testing, TestFlight, or any production launch push. Run it on at least one Android phone and one iPhone-sized viewport or device. Use safe sample content only.

## Setup

- Run `npm run smoke:public` against production and confirm public routes, private redirects, public fallback detail pages, metadata, and safety-copy checks pass.
- Run `npm run smoke:mobile` against production and confirm the 390px mobile browser checks pass for auth, support/help/legal, search/profile, missing-detail fallback, and checkout-status routes before manual device testing.
- Confirm the build points at `https://thetattoocore.com/login`.
- Confirm support, privacy, and terms links open from logged-out and logged-in surfaces.
- Open Help Center on mobile, search for "getting started", and confirm the first-run guide explains account type, profile setup, privacy, launch content rules, main sections, verification, and Support.
- Open Help Center on mobile, search for "saved", and confirm the Search/Saved guide explains usernames, broader terms, privacy-safe results, and saved search shortcuts.
- Open the Help Center privacy/safety/support guide on mobile and confirm it explains reports, blocks, account deletion requests, support boundaries, and private account issues.
- Open the Booking guide and confirm it explains deposit confirmation, TTC fee visibility, private calendar-note limits, and refund-review expectations.
- Open the Ads guide and confirm it explains 4U/Gossip placements, Merch-only ads, ad credits, review rules, keyword safety, and payment status.
- Open the Merch guide and confirm it explains private buyer shipping details, tracking, seller fulfillment timing, missing/damaged/wrong/delayed/returned package support, and refund-review expectations.
- Open the Verification guide and confirm it explains document privacy, why approval matters, unlocked tools, and resubmission after rejection.
- Confirm public app copy uses `support@thetattoocore.com` or final company contact details, not personal owner contact data.
- Confirm the browser/install prompt does not block vertical scrolling after the user ignores it.
- Confirm light mode and dark mode text is readable on every tested route.

## Auth And Account

- Create a new account from `/signup` with the 18+ checkbox.
- Confirm email delivery and confirmation redirect.
- Sign in from `/login`; confirm the signup controls are not mixed into the login form.
- Run forgot-password and reset-password flows.
- Complete profile setup with avatar, display name, username, bio, website, social links, language, country, and coarse location.
- Confirm profile tabs fit mobile screens and do not create horizontal page overflow.
- Confirm account deletion request flow creates a request and shows clear next steps.

## Core Social

- Create a 4U image post and a short video post.
- Use the image crop tools before posting in at least one upload area; confirm original, square, portrait, landscape, or banner framing previews update and the final upload uses the selected crop.
- Create a Story photo/GIF/short video and confirm it appears in the Stories rail, opens in the media viewer, plays videos without a visible download button, and expires from the rail after the expiry window in later QA.
- With no active Stories, confirm the rail shows a clear "No active stories yet" prompt instead of disabled or coming-soon placeholders.
- Open a Story from a public profile and confirm signed-in viewers can react, send a DM reply, and report from the viewer without opening the wrong composer.
- Confirm 4U captions respect the 40-word limit.
- Open 4U media in the lightbox, zoom images, play videos, and confirm video controls do not show a download button.
- Create a Gossip post with longer text and optional image.
- Like, save, share, report, edit, and delete owned 4U/Gossip content.
- Confirm home cards show comment counts only, then open detail pages for full comments.
- Add, like, reply to, edit, delete, and report comments where supported.
- Attach a photo/GIF to 4U and Gossip detail comments/replies, then open the attachment in the lightbox.
- Confirm post owners can hide/delete disruptive comments where supported.
- Search for a public profile and a private profile connected by an accepted follow relationship; confirm signed-in search finds both while logged-out search stays public-only.

## Commerce And Listings

- Create, edit, archive, and view a Stuff listing as an eligible verified account.
- Confirm non-verified users can browse Stuff but cannot transact or contact sellers.
- Create, edit, archive, and view a Gig.
- Create, edit, archive, and view a Merch product.
- Open the Merch storefront on mobile and confirm the Merch Help and Seller Tools links are visible without horizontal overflow.
- Run Stripe test checkout for Merch and verify success, receipt, buyer history, seller history, admin payments, and webhook status.
- Open a Merch product detail page before checkout and confirm the Merch Help link is visible near checkout guidance.
- Confirm checkout remains test-mode until production payment, tax, refund, dispute, shipping, and payout policy is approved.

## Messaging

- Confirm the main swipe tabs are 4U, Gossip, Stuff, Gigs, and Merch only; DM access should come from the bottom DM shortcut, profile DM buttons, notifications, Story replies, or `/messages`.
- Start a DM from another user's profile and confirm the recipient field/thread target is correct.
- In the DM inbox start form, type part of a connected follower/following member's username, display name, city, or region; confirm matching profile suggestions appear, selecting one fills the target, and the first message opens the correct thread.
- Send and receive a text message between two known test accounts.
- Send and receive a DM photo attachment.
- Open a selected DM thread on mobile and confirm the header and message input stay fixed while only the sent-message list scrolls.
- Tap the other member's name/avatar in the DM header and message list; confirm it opens that member's profile.
- Confirm delivered/read indicators update.
- Delete an unread outgoing DM and confirm it disappears for the sender without breaking the thread.
- Open a DM notification and confirm it routes to the correct thread without reload loops.
- Create a booking request, accept it with an appointment time, and confirm both Account and DM cards show the scheduled time plus a private Add to calendar download.

## Notifications

- Trigger notifications for likes, comments, replies, follows, follow requests, DMs, verification decisions, ad payments, and Merch order events where available.
- Open each notification type on mobile and confirm the target page stays inside the viewport.
- Confirm notification lists paginate or load more instead of growing into one long unbounded page.
- Confirm quiet-hours/category preferences save and display correctly.

## Verification And Admin

- Submit artist, studio, and vendor verification with a private license document under the current upload limit.
- Confirm submission success does not reload-loop or expose the license document publicly.
- Approve and reject verification from Admin > Verification.
- Confirm member notifications and important email behavior for verification decisions.
- Review Admin > Users, Verification, Reports, Content, Stuff, Gigs, Merch, Ads, Payments, Data Requests, Media Ops, and Mail Settings on mobile.
- In Admin > Payments, search by a safe test payment/event reference or booking title and confirm webhook receipts, payment audit rows, and booking deposits remain paginated and filterable.
- In Admin > Merch, search by a product/order/customer/payment reference and confirm product and order queues remain paginated and filterable.
- In Admin > Content > Stories, confirm temporary story rows show whether they expire soon or already expired.
- Confirm each admin page uses pagination or focused queues and the overview remains short.
- Confirm dark/light admin contrast is readable.

## Public Sharing And Safety

- Open public profile, 4U, Gossip, Stuff, Gigs, and Merch shared links while logged out.
- Confirm public-safe links show limited previews and correct Open Graph metadata.
- Confirm private routes redirect to `/login` with the right return path.
- Confirm sensitive or admin-restricted legacy content stays locked or blurred for logged-out users and does not expose the full media URL.
- Confirm visible nudity upload copy is removed from launch upload forms and the no-visible-nudity policy is clear.
- Confirm report/block tools are reachable and understandable on mobile.

## PWA And Store Readiness

- Install the PWA from the deliberate install action where supported.
- Confirm installed app start URL is `/login`.
- Confirm app icon, maskable icon, splash, shortcuts, and screenshots use TTC-branded assets.
- Confirm no default framework scaffold assets appear in install or review surfaces.
- Confirm service worker registration does not break routing, refresh, logout, or media loading.
- Confirm screenshots prepared for stores contain no private DMs, copyrighted tattoo art, nudity, license documents, personal email addresses, or real payment data.

## Pass Criteria

- No reload-loop screens.
- No document-level horizontal overflow on mobile.
- No unreadable white-on-white or black-on-black controls.
- No console errors during the tested happy paths.
- No personal owner contact data on public support/legal/store surfaces.
- No private, sensitive, admin-only, or full-resolution restricted media visible to logged-out users.
