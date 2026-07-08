create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow_request', 'follow_accepted', 'message')),
  subject_type text not null check (char_length(subject_type) between 2 and 80),
  subject_id uuid,
  title text not null check (char_length(title) between 2 and 120),
  body text check (body is null or char_length(body) <= 240),
  href text check (href is null or char_length(href) <= 240),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Users can create actor notifications" on public.notifications;
create policy "Users can create actor notifications"
  on public.notifications for insert
  to authenticated
  with check (
    (select auth.uid()) = actor_id
    and recipient_id <> actor_id
  );

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_read_idx
  on public.notifications (recipient_id, read_at);

create index if not exists notifications_actor_idx
  on public.notifications (actor_id);

grant select, insert, update, delete on public.notifications to authenticated;
