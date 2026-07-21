# Screenshot Prep

Use this before Google Play, App Store, PWA listing, press, or public launch screenshots.

## Required Screenshot Set

- Logged-out login page at `/login`, showing sign-in only and the separate signup path.
- Signup page at `/signup`, showing the 18+ confirmation without test emails or personal owner contact data.
- Home 4U feed with safe sample image/reel content, comment counts collapsed, and the TTC brand visible.
- Gossip detail page with safe sample discussion and comment controls.
- Stuff, Gigs, and Merch preview states with safe sample listings and no restricted professional-equipment sale to unverified buyers.
- Public profile with avatar, short bio, safe website/social links, verification badge only when approved, and optional shop/studio link.
- DM inbox or thread only with staged dummy messages. Do not show real member messages.
- Notifications page with staged non-sensitive alerts.
- Account/Profile settings only if the screenshot proves theme/readability, language, notification, or verification setup.
- Support or Help Center screen showing safe self-service guides for Merch, verification, booking deposits, privacy, and safety without exposing private account issues.

## Do Not Capture

- Personal owner email addresses, phone numbers, legal names, payment details, or private notes.
- Do not show private DMs, license/certification documents, admin-only queues, moderation notes, or data-request details.
- Visible nudity, pornography, sexualized content, minors in mature context, unsafe tattooing, or scratcher promotion.
- Copyrighted tattoo art, copyrighted music/audio, or real customer photos unless written rights are cleared.
- Provider, server, hosting, database, storage, payment-processor, mail-server, API-key, or infrastructure names in visible user-facing copy.
- Checkout screens with real payment data, seller payout details, tax IDs, bank details, dispute details, or refund evidence.

## Safe Sample Content

- Use TTC-owned logo, shield, splash, and generated clean UI assets.
- Use staged tattoo/body-art placeholders that are non-nude, non-sexual, and rights-cleared.
- Use dummy usernames, dummy business names, dummy order IDs, and dummy messages.
- Use neutral captions and comments that avoid medical claims, hate, illegal goods, dangerous instructions, or professional equipment sales to unverified users.
- Keep current limitations worded plainly, such as "limited right now" or "not available on this device yet," without naming internal services or future infrastructure.

## Final Review

- Check light and dark mode before capturing.
- Check the mobile viewport first; screenshots should not show horizontal overflow, clipped cards, unreadable controls, or sticky install prompts covering content.
- Run `npm.cmd run verify:store-release` before final screenshot upload validation so lint, production build, production environment boundaries, store metadata, PWA install assets, readiness docs, public routes, Android-profile mobile routes, and iOS-profile mobile routes are checked together.
- Run the real-device QA checklist before final screenshots.
- Compare final screenshot text against the Store Listing Draft, Terms, Privacy, and Support pages so 18+ positioning, no-visible-nudity rules, no-AI stance, and support contact are consistent.
- Confirm Help/Support screenshots show only public guide content and do not reveal private order details, seller payout setup details, support tickets, or moderation queues.

## Upload Validation Evidence

Keep screenshot upload evidence private with the release handoff. Do not add console screenshots that show reviewer passwords, private contact phone numbers, account owner details, payment-account data, or store-dashboard identifiers to public docs or member-facing copy.

Track each store asset set separately so one valid upload does not hide another missing set:

| Store asset set | Private evidence to capture | Repo-safe status |
| --- | --- | --- |
| Google Play phone screenshots | Release track, version, capture device, uploaded file set, and upload validation result. | `pending`, `uploaded`, `needs replacement`, or `validated`. |
| Google Play feature graphic | Uploaded feature graphic, validation result, capture/build date, and rights-safe source note. | `pending`, `uploaded`, `needs replacement`, or `validated`. |
| App Store iPhone 6.5-inch screenshots | iOS build/version, capture device, uploaded file set, and upload validation result. | `pending`, `uploaded`, `needs replacement`, or `validated`. |
| App Store 13-inch iPad screenshots | iOS build/version, iPad capture source, uploaded file set, and upload validation result. | `pending`, `uploaded`, `needs replacement`, or `validated`. |

- Apple App Store Connect: record the uploaded iPhone 6.5-inch set, 13-inch iPad set, upload validation result, build/version, capture date, and reviewer-safe notes.
- Current Apple 13-inch iPad screenshot validation should accept either 2064 x
  2752 or 2048 x 2732 portrait PNG/JPEG files when the app runs on iPad; record
  which accepted size was uploaded for the submitted build.
- Google Play Console: record the uploaded phone screenshot set, feature graphic, upload validation result, release track, capture date, and reviewer-safe notes.
- Google Play phone screenshots should be 8 MB or smaller per file in the
  selected upload set.
- Confirm every uploaded image still matches the submitted build after final metadata, privacy, age-rating, and payment-status edits.
- Confirm no uploaded image shows private DMs, license documents, admin queues, real payment data, personal owner contact details, visible infrastructure/provider names, visible nudity, copyrighted tattoo art, or unsafe marketplace examples.

## Private Upload Validation Packet

Use one private packet per release candidate. The repo-safe summary can say only whether each store asset set is `pending`, `uploaded`, `needs replacement`, `blocked`, or `validated`.

Each private packet should include:

- Store surface and asset set: Google Play phone screenshots, Google Play feature graphic, App Store iPhone 6.5-inch screenshots, or App Store 13-inch iPad screenshots.
- Submitted build or release track, app version/build number, capture device, capture date, and final uploaded filenames.
- Console validation result, rejection category if any, next action owner, and replacement due date.
- Confirmation that dimensions, file count, no-alpha output, and safe content rules passed for the exact files uploaded.
- Confirmation that generated draft screenshots were replaced or explicitly re-captured from the selected build before public review.

Keep raw console screenshots, rejection messages with account identifiers, reviewer credentials, tester emails, personal phone details, device identifiers, and store-dashboard IDs in the private handoff only.
