alter table public.notifications
  add column if not exists message_id uuid
  references public.messages(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_message_id_type_check;

alter table public.notifications
  add constraint notifications_message_id_type_check
  check (message_id is null or type = 'message');

create index if not exists notifications_message_id_idx
  on public.notifications (message_id)
  where message_id is not null;

comment on column public.notifications.message_id is
  'Exact DM source for cascade cleanup when an unread message is deleted.';
