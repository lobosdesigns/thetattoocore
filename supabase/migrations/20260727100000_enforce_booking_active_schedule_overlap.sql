create extension if not exists btree_gist;

alter table public.booking_requests
  drop constraint if exists booking_requests_active_schedule_no_overlap;

alter table public.booking_requests
  add constraint booking_requests_active_schedule_no_overlap
  exclude using gist (
    artist_id with =,
    tstzrange(scheduled_start_at, scheduled_end_at, '[)') with &&
  )
  where (
    scheduled_start_at is not null
    and scheduled_end_at is not null
    and status in ('accepted', 'rescheduled', 'deposit_pending', 'deposit_paid')
  );

-- Verification SQL:
-- select conname from pg_constraint where conname = 'booking_requests_active_schedule_no_overlap';
--
-- Rollback SQL:
-- alter table public.booking_requests drop constraint if exists booking_requests_active_schedule_no_overlap;
