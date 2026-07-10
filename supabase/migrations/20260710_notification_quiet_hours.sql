alter table public.profiles
  add column if not exists notification_quiet_hours_enabled boolean not null default false,
  add column if not exists notification_quiet_hours_start time without time zone not null default time '22:00',
  add column if not exists notification_quiet_hours_end time without time zone not null default time '08:00',
  add column if not exists notification_timezone text not null default 'America/Chicago',
  add column if not exists notify_email_important boolean not null default true,
  add column if not exists notify_push_enabled boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_notification_timezone_check;

alter table public.profiles
  add constraint profiles_notification_timezone_check
  check (char_length(notification_timezone) between 2 and 80);

create index if not exists profiles_notification_quiet_hours_idx
  on public.profiles (
    notification_quiet_hours_enabled,
    notification_timezone,
    notification_quiet_hours_start,
    notification_quiet_hours_end
  );
