drop policy if exists "Users manage own story media" on public.story_media;

create policy "Users insert own story media"
  on public.story_media for insert
  to authenticated
  with check (
    exists (
      select 1 from public.story_posts
      where story_posts.id = story_media.story_id
      and story_posts.author_id = (select auth.uid())
    )
  );

create policy "Users update own story media"
  on public.story_media for update
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

create policy "Users delete own story media"
  on public.story_media for delete
  to authenticated
  using (
    exists (
      select 1 from public.story_posts
      where story_posts.id = story_media.story_id
      and story_posts.author_id = (select auth.uid())
    )
  );
