alter table public.booking_settings
  add column if not exists cancellation_policy text;

alter table public.booking_settings
  drop constraint if exists booking_settings_cancellation_policy_check;

alter table public.booking_settings
  add constraint booking_settings_cancellation_policy_check
  check (cancellation_policy is null or char_length(cancellation_policy) <= 500);
