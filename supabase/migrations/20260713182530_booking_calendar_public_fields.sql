alter table public.booking_settings
  add column if not exists booking_url text,
  add column if not exists calendar_notes text;

alter table public.booking_settings
  drop constraint if exists booking_settings_booking_url_check,
  add constraint booking_settings_booking_url_check
    check (
      booking_url is null
      or (
        char_length(booking_url) <= 500
        and booking_url ~ '^https?://'
      )
    );

alter table public.booking_settings
  drop constraint if exists booking_settings_calendar_notes_check,
  add constraint booking_settings_calendar_notes_check
    check (calendar_notes is null or char_length(calendar_notes) <= 500);
