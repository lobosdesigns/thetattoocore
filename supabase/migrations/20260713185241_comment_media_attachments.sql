alter table public.post_comments
  drop constraint if exists post_comments_body_word_limit_check,
  add constraint post_comments_body_word_limit_check
  check (
    char_length(body) <= 500
    and (
      body = ''
      or cardinality(regexp_split_to_array(trim(body), '\s+')) <= 40
    )
  );

alter table public.thread_comments
  drop constraint if exists thread_comments_body_check,
  add constraint thread_comments_body_check
  check (char_length(body) between 0 and 2000);

create table if not exists public.post_comment_media (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  storage_bucket text not null default 'tattoo-media',
  storage_path text not null,
  media_type text not null default 'image',
  mime_type text,
  file_size_bytes integer,
  width integer,
  height integer,
  original_filename text,
  created_at timestamptz not null default now(),
  constraint post_comment_media_one_per_comment unique (comment_id),
  constraint post_comment_media_type_check check (media_type = 'image'),
  constraint post_comment_media_bucket_check check (storage_bucket = 'tattoo-media'),
  constraint post_comment_media_file_size_check check (file_size_bytes is null or file_size_bytes between 1 and 5242880),
  constraint post_comment_media_dimensions_check check (
    (width is null or width between 1 and 8000)
    and (height is null or height between 1 and 8000)
  ),
  constraint post_comment_media_filename_check check (original_filename is null or char_length(original_filename) <= 180),
  constraint post_comment_media_mime_check check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
);

create table if not exists public.thread_comment_media (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.thread_comments(id) on delete cascade,
  storage_bucket text not null default 'tattoo-media',
  storage_path text not null,
  media_type text not null default 'image',
  mime_type text,
  file_size_bytes integer,
  width integer,
  height integer,
  original_filename text,
  created_at timestamptz not null default now(),
  constraint thread_comment_media_one_per_comment unique (comment_id),
  constraint thread_comment_media_type_check check (media_type = 'image'),
  constraint thread_comment_media_bucket_check check (storage_bucket = 'tattoo-media'),
  constraint thread_comment_media_file_size_check check (file_size_bytes is null or file_size_bytes between 1 and 5242880),
  constraint thread_comment_media_dimensions_check check (
    (width is null or width between 1 and 8000)
    and (height is null or height between 1 and 8000)
  ),
  constraint thread_comment_media_filename_check check (original_filename is null or char_length(original_filename) <= 180),
  constraint thread_comment_media_mime_check check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
);

alter table public.post_comment_media enable row level security;
alter table public.thread_comment_media enable row level security;

drop policy if exists "Members can read visible post comment media" on public.post_comment_media;
create policy "Members can read visible post comment media"
  on public.post_comment_media for select
  to authenticated
  using (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_media.comment_id
      and post_comments.deleted_at is null
    )
  );

drop policy if exists "Comment authors can attach post comment media" on public.post_comment_media;
create policy "Comment authors can attach post comment media"
  on public.post_comment_media for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_media.comment_id
      and post_comments.author_id = (select auth.uid())
      and post_comments.deleted_at is null
    )
  );

drop policy if exists "Comment authors can remove post comment media" on public.post_comment_media;
create policy "Comment authors can remove post comment media"
  on public.post_comment_media for delete
  to authenticated
  using (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_media.comment_id
      and post_comments.author_id = (select auth.uid())
    )
  );

drop policy if exists "Members can read visible thread comment media" on public.thread_comment_media;
create policy "Members can read visible thread comment media"
  on public.thread_comment_media for select
  to authenticated
  using (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_media.comment_id
      and thread_comments.deleted_at is null
    )
  );

drop policy if exists "Comment authors can attach thread comment media" on public.thread_comment_media;
create policy "Comment authors can attach thread comment media"
  on public.thread_comment_media for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_media.comment_id
      and thread_comments.author_id = (select auth.uid())
      and thread_comments.deleted_at is null
    )
  );

drop policy if exists "Comment authors can remove thread comment media" on public.thread_comment_media;
create policy "Comment authors can remove thread comment media"
  on public.thread_comment_media for delete
  to authenticated
  using (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_media.comment_id
      and thread_comments.author_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.post_comment_media to authenticated;
grant select, insert, delete on public.thread_comment_media to authenticated;

create index if not exists post_comment_media_comment_idx
  on public.post_comment_media (comment_id);

create index if not exists thread_comment_media_comment_idx
  on public.thread_comment_media (comment_id);
