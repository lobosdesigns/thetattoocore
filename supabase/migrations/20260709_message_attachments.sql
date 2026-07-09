insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'message-media',
  'message-media',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'message-media',
  storage_path text not null unique,
  media_type text not null default 'image' check (media_type = 'image'),
  mime_type text not null check (char_length(mime_type) between 3 and 120),
  file_size_bytes integer not null check (file_size_bytes between 1 and 10485760),
  original_filename text,
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  created_at timestamptz not null default now(),
  constraint message_attachments_original_filename_check
    check (original_filename is null or char_length(original_filename) <= 180)
);

alter table public.message_attachments enable row level security;

drop policy if exists "Members can read message attachments"
  on public.message_attachments;
create policy "Members can read message attachments"
  on public.message_attachments for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages
      join public.conversation_members
        on conversation_members.conversation_id = messages.conversation_id
      where messages.id = message_attachments.message_id
        and conversation_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Members can send message attachments"
  on public.message_attachments;
create policy "Members can send message attachments"
  on public.message_attachments for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.messages
      join public.conversation_members
        on conversation_members.conversation_id = messages.conversation_id
      where messages.id = message_attachments.message_id
        and messages.sender_id = (select auth.uid())
        and conversation_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Senders can delete own message attachments"
  on public.message_attachments;
create policy "Senders can delete own message attachments"
  on public.message_attachments for delete
  to authenticated
  using (sender_id = (select auth.uid()));

create index if not exists message_attachments_message_idx
  on public.message_attachments (message_id, created_at);

create index if not exists message_attachments_sender_idx
  on public.message_attachments (sender_id, created_at desc);

grant select, insert, delete on public.message_attachments to authenticated;

drop policy if exists "Members can read message media"
  on storage.objects;
create policy "Members can read message media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-media'
    and exists (
      select 1
      from public.message_attachments
      join public.messages
        on messages.id = message_attachments.message_id
      join public.conversation_members
        on conversation_members.conversation_id = messages.conversation_id
      where message_attachments.storage_bucket = storage.objects.bucket_id
        and message_attachments.storage_path = storage.objects.name
        and conversation_members.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users upload own message media"
  on storage.objects;
create policy "Users upload own message media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete own message media"
  on storage.objects;
create policy "Users delete own message media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
