alter table public.booking_requests
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists scheduled_timezone text;

alter table public.booking_requests
  drop constraint if exists booking_requests_schedule_check;

alter table public.booking_requests
  add constraint booking_requests_schedule_check
  check (
    (
      scheduled_start_at is null
      and scheduled_end_at is null
      and scheduled_timezone is null
    )
    or (
      scheduled_start_at is not null
      and scheduled_end_at is not null
      and scheduled_end_at > scheduled_start_at
      and scheduled_end_at <= scheduled_start_at + interval '12 hours'
      and scheduled_timezone is not null
      and char_length(scheduled_timezone) between 3 and 80
    )
  );

create index if not exists booking_requests_scheduled_start_idx
  on public.booking_requests (scheduled_start_at)
  where scheduled_start_at is not null;
