create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  shop_profile_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  body text not null,
  placement text,
  style_tags text,
  preferred_city text,
  preferred_dates text,
  deposit_amount_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'requested',
  payment_status text not null default 'not_ready',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  accepted_at timestamptz,
  artist_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_requests_member_check check (client_id <> artist_id),
  constraint booking_requests_title_check check (char_length(title) between 3 and 120),
  constraint booking_requests_body_check check (char_length(body) between 10 and 2000),
  constraint booking_requests_optional_text_check check (
    (placement is null or char_length(placement) <= 120)
    and (style_tags is null or char_length(style_tags) <= 160)
    and (preferred_city is null or char_length(preferred_city) <= 120)
    and (preferred_dates is null or char_length(preferred_dates) <= 240)
    and (artist_note is null or char_length(artist_note) <= 1000)
    and (admin_note is null or char_length(admin_note) <= 1000)
  ),
  constraint booking_requests_money_check check (
    deposit_amount_cents between 0 and 500000
    and platform_fee_cents >= 0
    and total_cents = deposit_amount_cents + platform_fee_cents
  ),
  constraint booking_requests_currency_check check (currency in ('USD')),
  constraint booking_requests_status_check check (
    status in (
      'requested',
      'accepted',
      'declined',
      'cancelled',
      'deposit_pending',
      'deposit_paid',
      'completed'
    )
  ),
  constraint booking_requests_payment_status_check check (
    payment_status in (
      'not_ready',
      'checkout_started',
      'paid',
      'payment_failed',
      'refunded',
      'waived'
    )
  )
);

alter table public.booking_requests enable row level security;

drop policy if exists "Booking participants can read requests" on public.booking_requests;
create policy "Booking participants can read requests"
  on public.booking_requests for select
  to authenticated
  using (
    (select auth.uid()) in (client_id, artist_id)
    or private.current_user_can_moderate()
  );

drop policy if exists "Members can request verified booking recipients" on public.booking_requests;
create policy "Members can request verified booking recipients"
  on public.booking_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = client_id
    and client_id <> artist_id
    and status = 'requested'
    and payment_status = 'not_ready'
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
    and paid_at is null
    and exists (
      select 1
      from public.profiles artist
      where artist.id = artist_id
      and artist.account_type in ('artist', 'studio')
      and artist.license_verified_at is not null
      and artist.suspended_at is null
      and artist.banned_at is null
      and (
        shop_profile_id is null
        or (artist.account_type = 'studio' and shop_profile_id = artist.id)
        or (
          artist.account_type = 'artist'
          and artist.shop_profile_id = shop_profile_id
        )
      )
    )
  );

drop policy if exists "Moderators can update booking requests" on public.booking_requests;
create policy "Moderators can update booking requests"
  on public.booking_requests for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

grant select, insert, update on public.booking_requests to authenticated;

create index if not exists booking_requests_client_created_idx
  on public.booking_requests (client_id, created_at desc);

create index if not exists booking_requests_artist_created_idx
  on public.booking_requests (artist_id, created_at desc);

create index if not exists booking_requests_status_created_idx
  on public.booking_requests (status, created_at desc);

create index if not exists booking_requests_conversation_idx
  on public.booking_requests (conversation_id, created_at desc)
  where conversation_id is not null;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow_request',
    'follow_accepted',
    'message',
    'feed_like',
    'feed_comment',
    'thread_like',
    'thread_comment',
    'new_follow',
    'verification_approved',
    'verification_rejected',
    'merch_paid',
    'merch_fulfilled',
    'merch_refunded',
    'merch_payment_failed',
    'merch_cancelled',
    'ad_paid',
    'ad_payment_failed',
    'ad_refunded',
    'booking_request',
    'booking_accepted',
    'booking_declined',
    'booking_deposit_paid'
  ));
