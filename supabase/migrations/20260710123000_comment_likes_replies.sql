alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

alter table public.thread_comments
  add column if not exists parent_id uuid references public.thread_comments(id) on delete cascade;

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.thread_comment_likes (
  comment_id uuid not null references public.thread_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.post_comment_likes enable row level security;
alter table public.thread_comment_likes enable row level security;

create or replace function public.enforce_post_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.post_comments parent
    where parent.id = new.parent_id
    and parent.post_id = new.post_id
  ) then
    raise exception 'Post comment replies must belong to the same post.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_thread_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.thread_comments parent
    where parent.id = new.parent_id
    and parent.thread_id = new.thread_id
  ) then
    raise exception 'Thread comment replies must belong to the same thread.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_post_comment_parent() from public;
revoke execute on function public.enforce_thread_comment_parent() from public;

drop trigger if exists enforce_post_comment_parent on public.post_comments;
create trigger enforce_post_comment_parent
before insert or update on public.post_comments
for each row execute function public.enforce_post_comment_parent();

drop trigger if exists enforce_thread_comment_parent on public.thread_comments;
create trigger enforce_thread_comment_parent
before insert or update on public.thread_comments
for each row execute function public.enforce_thread_comment_parent();

drop policy if exists "Visible post comment likes can be read" on public.post_comment_likes;
create policy "Visible post comment likes can be read"
  on public.post_comment_likes for select
  using (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_likes.comment_id
    )
  );

drop policy if exists "Users can like visible post comments" on public.post_comment_likes;
create policy "Users can like visible post comments"
  on public.post_comment_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_likes.comment_id
    )
  );

drop policy if exists "Users can unlike post comments" on public.post_comment_likes;
create policy "Users can unlike post comments"
  on public.post_comment_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Visible thread comment likes can be read" on public.thread_comment_likes;
create policy "Visible thread comment likes can be read"
  on public.thread_comment_likes for select
  using (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_likes.comment_id
    )
  );

drop policy if exists "Users can like visible thread comments" on public.thread_comment_likes;
create policy "Users can like visible thread comments"
  on public.thread_comment_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_likes.comment_id
    )
  );

drop policy if exists "Users can unlike thread comments" on public.thread_comment_likes;
create policy "Users can unlike thread comments"
  on public.thread_comment_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists post_comments_parent_created_idx
  on public.post_comments (parent_id, created_at);

create index if not exists thread_comments_parent_created_idx
  on public.thread_comments (parent_id, created_at);

create index if not exists post_comment_likes_user_idx
  on public.post_comment_likes (user_id);

create index if not exists thread_comment_likes_user_idx
  on public.thread_comment_likes (user_id);

grant select on public.post_comment_likes to anon, authenticated;
grant select on public.thread_comment_likes to anon, authenticated;
grant insert, delete on public.post_comment_likes to authenticated;
grant insert, delete on public.thread_comment_likes to authenticated;
