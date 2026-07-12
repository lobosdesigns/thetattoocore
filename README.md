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
- Stories are planned for later, after the core feed, Gossip, Stuff, Gigs, and
  DMs are stable.
- TheTattooCore supports freedom of body-art expression when content follows
  safety, consent, legality, and adult-content guidelines.
- Visible nudity is not allowed for launch. Members should crop or cover
  private areas before posting tattooing, piercing, scars, healing, placement,
  or body-art documentation.
- The platform should feel like a safe home for the body-art community without
  unwanted AI, spam, harassment, scams, or dangerous unprofessional practice.

## Development

```bash
npm run dev
```

## Verification

```bash
npm run lint
npm run build
npm run smoke:media
npm run smoke:theme
npm run smoke:public
```

## Production Secrets

Cloudflare needs these public variables and server-only bindings for full
production behavior:

- `NEXT_PUBLIC_SITE_URL`: canonical site URL, currently `https://thetattoocore.com`.
- `NEXT_PUBLIC_SUPABASE_URL`: browser-safe Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase publishable key.
- `HOSTGATOR_SMTP_PASSWORD`: required for HostGator transactional email.
- `SUPABASE_SERVICE_ROLE_KEY`: required for server-only Supabase Auth email lookup, used by verification approval/rejection emails. Never expose this as a `NEXT_PUBLIC_` variable.
- `STRIPE_SECRET_KEY`: server-only Stripe key for test/live checkout sessions.
- `STRIPE_WEBHOOK_SECRET`: server-only webhook signing secret for Stripe payment status updates.

Keep public support and reply-to email on company mail such as
`support@thetattoocore.com`. Do not put personal owner contact details in public
app copy or store metadata.

After adding or rotating secrets, redeploy with:

```bash
npm run deploy
```
