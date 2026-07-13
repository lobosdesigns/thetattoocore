drop policy if exists "Members can read visible post comment media" on public.post_comment_media;
create policy "Members can read visible post comment media"
  on public.post_comment_media for select
  to authenticated
  using (
    exists (
      select 1
      from public.post_comments
      join public.feed_posts on feed_posts.id = post_comments.post_id
      where post_comments.id = post_comment_media.comment_id
      and post_comments.deleted_at is null
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and not exists (
        select 1
        from public.post_comment_hides
        where post_comment_hides.comment_id = post_comments.id
      )
      and (
        feed_posts.author_id = (select auth.uid())
        or (
          feed_posts.visibility = 'public_preview'
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1
              from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          feed_posts.visibility = 'members'
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1
              from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
      )
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
      join public.feed_posts on feed_posts.id = post_comments.post_id
      where post_comments.id = post_comment_media.comment_id
      and post_comments.author_id = (select auth.uid())
      and post_comments.deleted_at is null
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        feed_posts.visibility in ('public_preview', 'members')
        or feed_posts.author_id = (select auth.uid())
      )
      and (
        not feed_posts.is_sensitive
        or feed_posts.author_id = (select auth.uid())
        or exists (
          select 1
          from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
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
      join public.thread_posts on thread_posts.id = thread_comments.thread_id
      where thread_comments.id = thread_comment_media.comment_id
      and thread_comments.deleted_at is null
      and thread_posts.moderation_status = 'active'
      and not exists (
        select 1
        from public.thread_comment_hides
        where thread_comment_hides.comment_id = thread_comments.id
      )
      and (
        thread_posts.author_id = (select auth.uid())
        or (
          thread_posts.visibility = 'public_preview'
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1
              from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          thread_posts.visibility = 'members'
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1
              from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
      )
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
      join public.thread_posts on thread_posts.id = thread_comments.thread_id
      where thread_comments.id = thread_comment_media.comment_id
      and thread_comments.author_id = (select auth.uid())
      and thread_comments.deleted_at is null
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.visibility in ('public_preview', 'members')
        or thread_posts.author_id = (select auth.uid())
      )
      and (
        not thread_posts.is_sensitive
        or thread_posts.author_id = (select auth.uid())
        or exists (
          select 1
          from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
    )
  );
