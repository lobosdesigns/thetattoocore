# App Store Readiness

## Ready URLs

- App URL: https://thetattoocore.com
- Login / installed app start URL: https://thetattoocore.com/login
- Support URL: https://thetattoocore.com/support
- Privacy URL: https://thetattoocore.com/privacy
- Terms URL: https://thetattoocore.com/terms

## Current Launch Position

- TheTattooCore is 18+ only.
- Visible nudity is not allowed for launch.
- Sensitive non-nude body-art media stays behind login and 18+ confirmation.
- Public support and account deletion request paths exist.
- Admins and moderators can review account deletion requests from the admin data-request queue.
- Public support and privacy pages explain that launch deletion requests are manually reviewed, with a target review window of 30 days unless safety, dispute, fraud, legal, or retention obligations require more time.
- Members can block and unblock profiles; blocked relationships prevent follow and DM attempts.
- PWA manifest is active and starts installed sessions at `/login`.
- Automatic mobile browser install prompts are suppressed during regular browsing so the install sheet does not interfere with feed scrolling; add a deliberate install action later if needed.
- PNG PWA icons are generated from the approved TTC shield, including a maskable launcher icon.
- Branded splash and clean PWA screenshot assets are generated without user, sensitive, or copyrighted tattoo content.
- Core social flows are web-first; native wrappers are not ready for submission yet.

## Before Google Play / App Store Submission

- Map the generated splash/screenshot assets into the native wrapper once Android/iOS packaging starts.
- Package native builds through the chosen wrapper path.
- Add production support/legal contact details and final counsel-reviewed Terms/Privacy.
- Have counsel review the final account deletion SLA, legal hold rules, and manual deletion checklist before store submission.
- Decide when to automate irreversible user-data deletion versus keeping early launch deletion manual.
- Test signup, login, posting, reporting, blocking/safety, DMs, and account deletion requests on real mobile devices.
- Prepare final store screenshots after mobile QA, using no sensitive or copyrighted user content.
- Confirm no AI-generated tattoo art claims appear in store metadata or screenshots.
