alter table public.profiles
  add column if not exists notify_follow_activity boolean not null default true,
  add column if not exists notify_message_activity boolean not null default true,
  add column if not exists notify_feed_activity boolean not null default true,
  add column if not exists notify_thread_activity boolean not null default true,
  add column if not exists notify_marketplace_gig_activity boolean not null default true;

create index if not exists profiles_notification_preferences_idx
  on public.profiles (
    notify_follow_activity,
    notify_message_activity,
    notify_feed_activity,
    notify_thread_activity,
    notify_marketplace_gig_activity
  );
