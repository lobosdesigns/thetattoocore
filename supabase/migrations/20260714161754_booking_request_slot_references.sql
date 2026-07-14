alter table public.booking_requests
  add column if not exists appointment_type_id uuid
    references public.booking_appointment_types(id) on delete set null,
  add column if not exists preferred_slot_id uuid
    references public.booking_availability_slots(id) on delete set null;

create index if not exists booking_requests_appointment_type_created_idx
  on public.booking_requests (appointment_type_id, created_at desc)
  where appointment_type_id is not null;

create index if not exists booking_requests_preferred_slot_created_idx
  on public.booking_requests (preferred_slot_id, created_at desc)
  where preferred_slot_id is not null;
