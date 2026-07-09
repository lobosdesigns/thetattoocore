create table if not exists public.saved_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (
    subject_type in (
      'feed_post',
      'thread_post',
      'marketplace_listing',
      'gig',
      'profile'
    )
  ),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_type, subject_id)
);

alter table public.saved_items enable row level security;

drop policy if exists "Users can view own saved items" on public.saved_items;
create policy "Users can view own saved items"
  on public.saved_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can save items" on public.saved_items;
create policy "Users can save items"
  on public.saved_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unsave own items" on public.saved_items;
create policy "Users can unsave own items"
  on public.saved_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.saved_items to authenticated;
revoke all on public.saved_items from anon;

create index if not exists saved_items_subject_idx
  on public.saved_items (subject_type, subject_id, created_at desc);

create index if not exists saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);
