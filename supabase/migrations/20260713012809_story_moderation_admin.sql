alter type public.report_subject_type add value if not exists 'story_post';

drop policy if exists "Moderators can review story posts" on public.story_posts;
create policy "Moderators can review story posts"
  on public.story_posts for select
  to authenticated
  using (private.current_user_can_moderate());

drop policy if exists "Moderators can update story posts" on public.story_posts;
create policy "Moderators can update story posts"
  on public.story_posts for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());
