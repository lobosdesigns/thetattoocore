alter table public.booking_requests
  drop constraint if exists booking_requests_status_check;

alter table public.booking_requests
  add constraint booking_requests_status_check check (
    status in (
      'requested',
      'accepted',
      'declined',
      'needs_changes',
      'rescheduled',
      'cancelled',
      'expired',
      'deposit_pending',
      'deposit_paid',
      'completed'
    )
  );

alter table public.booking_requests
  add column if not exists needs_changes_at timestamptz,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists status_changed_at timestamptz not null default now();

create table if not exists public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint booking_status_events_status_check check (
    (from_status is null or from_status in (
      'requested',
      'accepted',
      'declined',
      'needs_changes',
      'rescheduled',
      'cancelled',
      'expired',
      'deposit_pending',
      'deposit_paid',
      'completed'
    ))
    and to_status in (
      'requested',
      'accepted',
      'declined',
      'needs_changes',
      'rescheduled',
      'cancelled',
      'expired',
      'deposit_pending',
      'deposit_paid',
      'completed'
    )
  ),
  constraint booking_status_events_note_check
    check (note is null or char_length(note) <= 1000)
);

alter table public.booking_status_events enable row level security;

drop policy if exists "Booking participants can read status events"
  on public.booking_status_events;
create policy "Booking participants can read status events"
  on public.booking_status_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_requests
      where booking_requests.id = booking_status_events.booking_id
      and (
        (select auth.uid()) in (
          booking_requests.client_id,
          booking_requests.artist_id
        )
        or private.current_user_can_moderate()
      )
    )
  );

drop policy if exists "Moderators can write booking status events"
  on public.booking_status_events;
create policy "Moderators can write booking status events"
  on public.booking_status_events for insert
  to authenticated
  with check (private.current_user_can_moderate());

grant select on public.booking_status_events to authenticated;
grant insert on public.booking_status_events to authenticated;

create index if not exists booking_status_events_booking_created_idx
  on public.booking_status_events (booking_id, created_at desc);

create index if not exists booking_requests_lifecycle_status_idx
  on public.booking_requests (artist_id, status, updated_at desc);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'follow_request',
      'follow_accepted',
      'message',
      'feed_like',
      'feed_comment',
      'feed_tag',
      'feed_comment_tag',
      'thread_like',
      'thread_comment',
      'thread_tag',
      'thread_comment_tag',
      'gig_tag',
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
      'booking_cancelled',
      'booking_deposit_paid',
      'booking_payment_failed',
      'booking_refunded',
      'booking_needs_changes',
      'booking_rescheduled',
      'booking_completed',
      'booking_expired',
      'story_reaction'
    )
  );

create or replace function public.reserve_booking_deposit_checkout(
  p_booking_id uuid,
  p_client_id uuid
)
returns setof public.booking_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_from_status text;
begin
  select booking.*
  into v_booking
  from public.booking_requests as booking
  join public.profiles as recipient
    on recipient.id = booking.artist_id
  where booking.id = p_booking_id
    and booking.client_id = p_client_id
    and booking.status in ('accepted', 'rescheduled')
    and booking.payment_status in ('not_ready', 'payment_failed')
    and booking.stripe_checkout_session_id is null
    and not booking.payment_dispute_hold
    and booking.deposit_amount_cents > 0
    and booking.total_cents > 0
    and recipient.account_type in ('artist', 'studio')
    and recipient.license_verified_at is not null
    and recipient.suspended_at is null
    and recipient.banned_at is null
    and (
      booking.shop_profile_id is null
      or (
        recipient.account_type = 'studio'
        and booking.shop_profile_id = recipient.id
      )
      or (
        recipient.account_type = 'artist'
        and recipient.shop_profile_id = booking.shop_profile_id
      )
    )
  for update of booking, recipient;

  if not found then
    return;
  end if;

  v_from_status := v_booking.status;

  update public.booking_requests as booking
  set
    payment_status = 'checkout_started',
    status = 'deposit_pending',
    stripe_checkout_session_id = null,
    status_changed_at = now(),
    updated_at = now()
  where booking.id = v_booking.id
  returning booking.* into v_booking;

  insert into public.booking_status_events (
    actor_id,
    booking_id,
    from_status,
    note,
    to_status
  ) values (
    p_client_id,
    v_booking.id,
    v_from_status,
    'Deposit checkout reserved.',
    'deposit_pending'
  );

  return next v_booking;
end;
$$;

revoke all on function public.reserve_booking_deposit_checkout(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_booking_deposit_checkout(uuid, uuid)
  to service_role;

-- Verification SQL:
-- select conname from pg_constraint where conname in ('booking_requests_status_check', 'notifications_type_check');
-- select to_regclass('public.booking_status_events') as booking_status_events;
-- select public.reserve_booking_deposit_checkout('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
--
-- Rollback SQL:
-- drop table if exists public.booking_status_events;
-- alter table public.booking_requests drop column if exists needs_changes_at, drop column if exists rescheduled_at, drop column if exists completed_at, drop column if exists expired_at, drop column if exists status_changed_at;
-- restore the prior booking_requests_status_check, notifications_type_check, and reserve_booking_deposit_checkout function from the previous migrations.
