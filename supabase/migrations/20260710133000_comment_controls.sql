alter table public.post_comments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.thread_comments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create table if not exists public.post_comment_hides (
  comment_id uuid primary key references public.post_comments(id) on delete cascade,
  hidden_by uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.thread_comment_hides (
  comment_id uuid primary key references public.thread_comments(id) on delete cascade,
  hidden_by uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.post_comment_hides enable row level security;
alter table public.thread_comment_hides enable row level security;

drop policy if exists "Visible post comment hides can be read" on public.post_comment_hides;
create policy "Visible post comment hides can be read"
  on public.post_comment_hides for select
  using (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_hides.comment_id
    )
  );

drop policy if exists "Post owners can hide comments" on public.post_comment_hides;
create policy "Post owners can hide comments"
  on public.post_comment_hides for insert
  to authenticated
  with check (
    hidden_by = (select auth.uid())
    and exists (
      select 1
      from public.post_comments
      join public.feed_posts on feed_posts.id = post_comments.post_id
      where post_comments.id = post_comment_hides.comment_id
      and feed_posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "Post owners can unhide comments" on public.post_comment_hides;
create policy "Post owners can unhide comments"
  on public.post_comment_hides for delete
  to authenticated
  using (
    hidden_by = (select auth.uid())
    or private.current_user_can_moderate()
    or exists (
      select 1
      from public.post_comments
      join public.feed_posts on feed_posts.id = post_comments.post_id
      where post_comments.id = post_comment_hides.comment_id
      and feed_posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "Visible thread comment hides can be read" on public.thread_comment_hides;
create policy "Visible thread comment hides can be read"
  on public.thread_comment_hides for select
  using (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_hides.comment_id
    )
  );

drop policy if exists "Thread owners can hide comments" on public.thread_comment_hides;
create policy "Thread owners can hide comments"
  on public.thread_comment_hides for insert
  to authenticated
  with check (
    hidden_by = (select auth.uid())
    and exists (
      select 1
      from public.thread_comments
      join public.thread_posts on thread_posts.id = thread_comments.thread_id
      where thread_comments.id = thread_comment_hides.comment_id
      and thread_posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "Thread owners can unhide comments" on public.thread_comment_hides;
create policy "Thread owners can unhide comments"
  on public.thread_comment_hides for delete
  to authenticated
  using (
    hidden_by = (select auth.uid())
    or private.current_user_can_moderate()
    or exists (
      select 1
      from public.thread_comments
      join public.thread_posts on thread_posts.id = thread_comments.thread_id
      where thread_comments.id = thread_comment_hides.comment_id
      and thread_posts.author_id = (select auth.uid())
    )
  );

create index if not exists post_comments_deleted_idx
  on public.post_comments(deleted_at);

create index if not exists thread_comments_deleted_idx
  on public.thread_comments(deleted_at);

create index if not exists post_comment_hides_hidden_by_idx
  on public.post_comment_hides(hidden_by);

create index if not exists thread_comment_hides_hidden_by_idx
  on public.thread_comment_hides(hidden_by);

grant select, insert, delete on public.post_comment_hides to authenticated;
grant select, insert, delete on public.thread_comment_hides to authenticated;

create or replace function public.delete_post_comment_for_current_user(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.post_comments
  set
    body = '[deleted]',
    deleted_at = now(),
    deleted_by = current_profile_id,
    updated_at = now()
  where id = target_comment_id
    and (
      author_id = current_profile_id
      or exists (
        select 1
        from public.feed_posts
        where feed_posts.id = post_comments.post_id
          and feed_posts.author_id = current_profile_id
      )
    );

  if not found then
    raise exception 'Only the comment author or post owner can delete it.';
  end if;
end;
$$;

create or replace function public.delete_thread_comment_for_current_user(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.thread_comments
  set
    body = '[deleted]',
    deleted_at = now(),
    deleted_by = current_profile_id,
    updated_at = now()
  where id = target_comment_id
    and (
      author_id = current_profile_id
      or exists (
        select 1
        from public.thread_posts
        where thread_posts.id = thread_comments.thread_id
          and thread_posts.author_id = current_profile_id
      )
    );

  if not found then
    raise exception 'Only the comment author or thread owner can delete it.';
  end if;
end;
$$;

grant execute on function public.delete_post_comment_for_current_user(uuid) to authenticated;
grant execute on function public.delete_thread_comment_for_current_user(uuid) to authenticated;
