# Real Device QA Checklist

Use this before native wrapper work, Google Play internal testing, TestFlight, or any production launch push. Run it on at least one Android phone and one iPhone-sized viewport or device. Use safe sample content only.

## Setup

- Confirm the build points at `https://thetattoocore.com/login`.
- Confirm support, privacy, and terms links open from logged-out and logged-in surfaces.
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
- Create a Story photo/GIF/short video and confirm it appears in the Stories rail, opens in the media viewer, plays videos without a visible download button, and expires from the rail after the expiry window in later QA.
- Open a Story from a public profile and confirm signed-in viewers can react, send a DM reply, and report from the viewer without opening the wrong composer.
- Confirm 4U captions respect the 40-word limit.
- Open 4U media in the lightbox, zoom images, play videos, and confirm video controls do not show a download button.
- Create a Gossip post with longer text and optional image.
- Like, save, share, report, edit, and delete owned 4U/Gossip content.
- Confirm home cards show comment counts only, then open detail pages for full comments.
- Add, like, reply to, edit, delete, and report comments where supported.
- Confirm post owners can hide/delete disruptive comments where supported.

## Commerce And Listings

- Create, edit, archive, and view a Stuff listing as an eligible verified account.
- Confirm non-verified users can browse Stuff but cannot transact or contact sellers.
- Create, edit, archive, and view a Gig.
- Create, edit, archive, and view a Merch product.
- Run Stripe test checkout for Merch and verify success, receipt, buyer history, seller history, admin payments, and webhook status.
- Confirm checkout remains test-mode until production payment, tax, refund, dispute, shipping, and payout policy is approved.

## Messaging

- Start a DM from another user's profile and confirm the recipient field/thread target is correct.
- Send and receive a text message between two known test accounts.
- Send and receive a DM photo attachment.
- Confirm delivered/read indicators update.
- Delete an unread outgoing DM and confirm it disappears for the sender without breaking the thread.
- Open a DM notification and confirm it routes to the correct thread without reload loops.

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
