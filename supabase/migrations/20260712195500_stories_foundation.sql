create table if not exists public.story_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text,
  visibility public.content_visibility not null default 'members',
  is_sensitive boolean not null default false,
  sensitive_reason text,
  moderation_status public.content_moderation_status not null default 'active',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_posts_caption_check
    check (caption is null or char_length(caption) <= 240),
  constraint story_posts_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '25 hours'),
  constraint story_posts_sensitive_reason_check
    check (
      not is_sensitive
      or sensitive_reason in (
        'body_art_nudity',
        'healing',
        'scar_cover',
        'piercing',
        'other'
      )
    )
);

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_posts(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null default 'image' check (media_type = 'image'),
  sort_order integer not null default 0,
  width integer,
  height integer,
  mime_type text,
  file_size_bytes integer,
  original_filename text,
  created_at timestamptz not null default now(),
  constraint story_media_metadata_check
    check (
      (mime_type is null or char_length(mime_type) between 3 and 120)
      and (file_size_bytes is null or file_size_bytes between 1 and 10485760)
      and (original_filename is null or char_length(original_filename) <= 180)
      and (width is null or width between 1 and 20000)
      and (height is null or height between 1 and 20000)
    )
);

alter table public.story_posts enable row level security;
alter table public.story_media enable row level security;

drop policy if exists "Visible active stories can be read" on public.story_posts;
create policy "Visible active stories can be read"
  on public.story_posts for select
  using (
    moderation_status = 'active'
    and expires_at > now()
    and (
      (
        visibility = 'public_preview'
        and not is_sensitive
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
      )
      or author_id = (select auth.uid())
    )
  );

drop policy if exists "Users create own stories" on public.story_posts;
create policy "Users create own stories"
  on public.story_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and is_sensitive = false
    and expires_at <= now() + interval '25 hours'
  );

drop policy if exists "Users archive own stories" on public.story_posts;
create policy "Users archive own stories"
  on public.story_posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "Story media follows story visibility" on public.story_media;
create policy "Story media follows story visibility"
  on public.story_media for select
  using (
    exists (
      select 1 from public.story_posts
      where story_posts.id = story_media.story_id
      and story_posts.moderation_status = 'active'
      and story_posts.expires_at > now()
      and (
        (
          story_posts.visibility = 'public_preview'
          and not story_posts.is_sensitive
        )
        or (
          story_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or story_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users manage own story media" on public.story_media;
create policy "Users manage own story media"
  on public.story_media for all
  to authenticated
  using (
    exists (
      select 1 from public.story_posts
      where story_posts.id = story_media.story_id
      and story_posts.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.story_posts
      where story_posts.id = story_media.story_id
      and story_posts.author_id = (select auth.uid())
    )
  );

grant select, insert, update on public.story_posts to authenticated;
grant select on public.story_posts to anon;
grant select, insert, update, delete on public.story_media to authenticated;
grant select on public.story_media to anon;

create index if not exists story_posts_active_created_idx
  on public.story_posts (expires_at, moderation_status, visibility, created_at desc);

create index if not exists story_posts_author_created_idx
  on public.story_posts (author_id, created_at desc);

create index if not exists story_media_story_sort_idx
  on public.story_media (story_id, sort_order);
