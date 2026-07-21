drop policy if exists "Users can comment on visible posts" on public.post_comments;
create policy "Users can comment on visible posts"
  on public.post_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1
      from public.feed_posts
      join public.profiles post_owner on post_owner.id = feed_posts.author_id
      where feed_posts.id = post_comments.post_id
        and public.current_user_can_interact_with_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
        and (
          feed_posts.author_id = (select auth.uid())
          or coalesce(post_owner.comment_permission, 'everyone') = 'everyone'
          or (
            post_owner.comment_permission = 'followers'
            and exists (
              select 1
              from public.follows
              where follows.follower_id = (select auth.uid())
                and follows.following_id = feed_posts.author_id
                and follows.status = 'accepted'
            )
          )
        )
    )
  );

drop policy if exists "Users can comment on visible threads" on public.thread_comments;
create policy "Users can comment on visible threads"
  on public.thread_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1
      from public.thread_posts
      join public.profiles thread_owner on thread_owner.id = thread_posts.author_id
      where thread_posts.id = thread_comments.thread_id
        and public.current_user_can_interact_with_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
        and (
          thread_posts.author_id = (select auth.uid())
          or coalesce(thread_owner.comment_permission, 'everyone') = 'everyone'
          or (
            thread_owner.comment_permission = 'followers'
            and exists (
              select 1
              from public.follows
              where follows.follower_id = (select auth.uid())
                and follows.following_id = thread_posts.author_id
                and follows.status = 'accepted'
            )
          )
        )
    )
  );
