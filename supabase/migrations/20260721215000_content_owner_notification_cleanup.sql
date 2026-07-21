drop policy if exists "Content owners can delete subject notifications" on public.notifications;
create policy "Content owners can delete subject notifications"
  on public.notifications
  for delete
  to authenticated
  using (
    (
      subject_type = 'feed_post'
      and exists (
        select 1
        from public.feed_posts
        where feed_posts.id = notifications.subject_id
          and feed_posts.author_id = (select auth.uid())
      )
    )
    or (
      subject_type = 'thread_post'
      and exists (
        select 1
        from public.thread_posts
        where thread_posts.id = notifications.subject_id
          and thread_posts.author_id = (select auth.uid())
      )
    )
    or (
      subject_type = 'gig'
      and exists (
        select 1
        from public.gigs
        where gigs.id = notifications.subject_id
          and gigs.poster_id = (select auth.uid())
      )
    )
  );
