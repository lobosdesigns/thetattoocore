alter table public.thread_posts
  drop constraint if exists thread_posts_body_check;

alter table public.thread_posts
  add constraint thread_posts_body_check
  check (char_length(body) between 1 and 8000);

create table if not exists public.thread_media (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.thread_posts(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.thread_likes (
  thread_id uuid not null references public.thread_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.thread_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.thread_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.thread_media enable row level security;
alter table public.thread_likes enable row level security;
alter table public.thread_comments enable row level security;

drop policy if exists "Thread media is public" on public.thread_media;
drop policy if exists "Authors manage thread media" on public.thread_media;
drop policy if exists "Authors insert thread media" on public.thread_media;
drop policy if exists "Authors update thread media" on public.thread_media;
drop policy if exists "Authors delete thread media" on public.thread_media;
drop policy if exists "Thread likes are public" on public.thread_likes;
drop policy if exists "Users can like threads" on public.thread_likes;
drop policy if exists "Users can unlike threads" on public.thread_likes;
drop policy if exists "Thread comments are public" on public.thread_comments;
drop policy if exists "Users can comment on threads" on public.thread_comments;
drop policy if exists "Users manage own thread comments" on public.thread_comments;

create policy "Thread media is public"
  on public.thread_media for select
  using (true);

create policy "Authors insert thread media"
  on public.thread_media for insert
  to authenticated
  with check (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.author_id = (select auth.uid())
    )
  );

create policy "Authors update thread media"
  on public.thread_media for update
  to authenticated
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.author_id = (select auth.uid())
    )
  );

create policy "Authors delete thread media"
  on public.thread_media for delete
  to authenticated
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.author_id = (select auth.uid())
    )
  );

create policy "Thread likes are public"
  on public.thread_likes for select
  using (true);

create policy "Users can like threads"
  on public.thread_likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unlike threads"
  on public.thread_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Thread comments are public"
  on public.thread_comments for select
  using (true);

create policy "Users can comment on threads"
  on public.thread_comments for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users manage own thread comments"
  on public.thread_comments for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create index if not exists thread_media_thread_idx
  on public.thread_media (thread_id, sort_order);

create index if not exists thread_posts_author_created_idx
  on public.thread_posts (author_id, created_at desc);

create index if not exists thread_likes_thread_idx
  on public.thread_likes (thread_id);

create index if not exists thread_likes_user_idx
  on public.thread_likes (user_id);

create index if not exists thread_comments_thread_created_idx
  on public.thread_comments (thread_id, created_at desc);

create index if not exists thread_comments_author_idx
  on public.thread_comments (author_id);

grant select on public.thread_media to anon, authenticated;
grant select on public.thread_likes to anon, authenticated;
grant select on public.thread_comments to anon, authenticated;
grant insert, update, delete on public.thread_media to authenticated;
grant insert, delete on public.thread_likes to authenticated;
grant insert, update, delete on public.thread_comments to authenticated;
