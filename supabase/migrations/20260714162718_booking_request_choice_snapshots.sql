alter table public.booking_requests
  add column if not exists appointment_type_label text,
  add column if not exists preferred_slot_label text;

alter table public.booking_requests
  drop constraint if exists booking_requests_choice_snapshot_check;

alter table public.booking_requests
  add constraint booking_requests_choice_snapshot_check
  check (
    (appointment_type_label is null or char_length(appointment_type_label) <= 120)
    and (preferred_slot_label is null or char_length(preferred_slot_label) <= 120)
  );
