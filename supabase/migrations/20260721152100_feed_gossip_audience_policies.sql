create or replace function public.current_user_can_view_sensitive_content()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.is_adult_confirmed
      and viewer.adult_terms_accepted_at is not null
  );
$$;

create or replace function public.current_user_is_accepted_follower(target_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.follows
    where follows.follower_id = (select auth.uid())
      and follows.following_id = target_profile_id
      and follows.status = 'accepted'
  );
$$;

create or replace function public.current_user_is_verified_artist_or_vendor()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.account_type in ('artist', 'vendor')
      and viewer.license_verified_at is not null
  );
$$;

create or replace function public.current_user_can_view_feed_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_is_published boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    post_is_published
    and post_moderation_status = 'active'
    and (
      author_profile_id = (select auth.uid())
      or (
        post_visibility = 'public_preview'
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'followers'
        and public.current_user_is_accepted_follower(author_profile_id)
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
    );
$$;

create or replace function public.current_user_can_view_thread_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    post_moderation_status = 'active'
    and (
      author_profile_id = (select auth.uid())
      or (
        post_visibility = 'public_preview'
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'followers'
        and public.current_user_is_accepted_follower(author_profile_id)
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'verified_professionals'
        and public.current_user_is_verified_artist_or_vendor()
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
    );
$$;

create or replace function public.current_user_can_interact_with_feed_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_is_published boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and public.current_user_can_view_feed_post(
      author_profile_id,
      post_visibility,
      post_is_sensitive,
      post_is_published,
      post_moderation_status
    )
    and (
      author_profile_id = (select auth.uid())
      or post_visibility in ('public_preview', 'members', 'followers')
    );
$$;

create or replace function public.current_user_can_interact_with_thread_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and public.current_user_can_view_thread_post(
      author_profile_id,
      post_visibility,
      post_is_sensitive,
      post_moderation_status
    )
    and (
      author_profile_id = (select auth.uid())
      or post_visibility in (
        'public_preview',
        'members',
        'followers',
        'verified_professionals'
      )
    );
$$;

revoke all on function public.current_user_can_view_sensitive_content() from public;
revoke all on function public.current_user_is_accepted_follower(uuid) from public;
revoke all on function public.current_user_is_verified_artist_or_vendor() from public;
revoke all on function public.current_user_can_view_feed_post(
  uuid,
  public.content_visibility,
  boolean,
  boolean,
  public.content_moderation_status
) from public;
revoke all on function public.current_user_can_view_thread_post(
  uuid,
  public.content_visibility,
  boolean,
  public.content_moderation_status
) from public;
revoke all on function public.current_user_can_interact_with_feed_post(
  uuid,
  public.content_visibility,
  boolean,
  boolean,
  public.content_moderation_status
) from public;
revoke all on function public.current_user_can_interact_with_thread_post(
  uuid,
  public.content_visibility,
  boolean,
  public.content_moderation_status
) from public;

grant execute on function public.current_user_can_view_sensitive_content() to anon, authenticated;
grant execute on function public.current_user_is_accepted_follower(uuid) to anon, authenticated;
grant execute on function public.current_user_is_verified_artist_or_vendor() to anon, authenticated;
grant execute on function public.current_user_can_view_feed_post(
  uuid,
  public.content_visibility,
  boolean,
  boolean,
  public.content_moderation_status
) to anon, authenticated;
grant execute on function public.current_user_can_view_thread_post(
  uuid,
  public.content_visibility,
  boolean,
  public.content_moderation_status
) to anon, authenticated;
grant execute on function public.current_user_can_interact_with_feed_post(
  uuid,
  public.content_visibility,
  boolean,
  boolean,
  public.content_moderation_status
) to authenticated;
grant execute on function public.current_user_can_interact_with_thread_post(
  uuid,
  public.content_visibility,
  boolean,
  public.content_moderation_status
) to authenticated;

drop policy if exists "Authors manage feed posts" on public.feed_posts;
create policy "Authors manage feed posts"
  on public.feed_posts for all
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and visibility in ('public_preview', 'members', 'followers', 'private')
  );

drop policy if exists "Visible feed posts can be read" on public.feed_posts;
create policy "Visible feed posts can be read"
  on public.feed_posts for select
  using (
    public.current_user_can_view_feed_post(
      author_id,
      visibility,
      is_sensitive,
      is_published,
      moderation_status
    )
  );

drop policy if exists "Visible feed media can be read" on public.feed_media;
create policy "Visible feed media can be read"
  on public.feed_media for select
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = feed_media.post_id
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Visible post likes can be read" on public.post_likes;
create policy "Visible post likes can be read"
  on public.post_likes for select
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = post_likes.post_id
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Users can like visible posts" on public.post_likes;
create policy "Users can like visible posts"
  on public.post_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.feed_posts
      where feed_posts.id = post_likes.post_id
        and public.current_user_can_interact_with_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Visible post comments can be read" on public.post_comments;
create policy "Visible post comments can be read"
  on public.post_comments for select
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = post_comments.post_id
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Users can comment on visible posts" on public.post_comments;
create policy "Users can comment on visible posts"
  on public.post_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1
      from public.feed_posts
      where feed_posts.id = post_comments.post_id
        and public.current_user_can_interact_with_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Visible feed post tags can be read" on public.feed_post_tags;
create policy "Visible feed post tags can be read"
  on public.feed_post_tags for select
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = feed_post_tags.post_id
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

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
        and not exists (
          select 1
          from public.post_comment_hides
          where post_comment_hides.comment_id = post_comments.id
        )
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
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
        and public.current_user_can_interact_with_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
    )
  );

drop policy if exists "Users create thread posts" on public.thread_posts;
create policy "Users create thread posts"
  on public.thread_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      visibility <> 'verified_professionals'
      or public.current_user_is_verified_artist_or_vendor()
    )
  );

drop policy if exists "Users update own thread posts" on public.thread_posts;
create policy "Users update own thread posts"
  on public.thread_posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and (
      visibility <> 'verified_professionals'
      or public.current_user_is_verified_artist_or_vendor()
    )
  );

drop policy if exists "Visible thread posts can be read" on public.thread_posts;
create policy "Visible thread posts can be read"
  on public.thread_posts for select
  using (
    public.current_user_can_view_thread_post(
      author_id,
      visibility,
      is_sensitive,
      moderation_status
    )
  );

drop policy if exists "Thread media follows thread visibility" on public.thread_media;
create policy "Thread media follows thread visibility"
  on public.thread_media for select
  using (
    exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_media.thread_id
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
    )
  );

drop policy if exists "Visible thread likes can be read" on public.thread_likes;
create policy "Visible thread likes can be read"
  on public.thread_likes for select
  using (
    exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
    )
  );

drop policy if exists "Users can like visible threads" on public.thread_likes;
create policy "Users can like visible threads"
  on public.thread_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
        and public.current_user_can_interact_with_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
    )
  );

drop policy if exists "Visible thread comments can be read" on public.thread_comments;
create policy "Visible thread comments can be read"
  on public.thread_comments for select
  using (
    exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_comments.thread_id
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
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
      where thread_posts.id = thread_comments.thread_id
        and public.current_user_can_interact_with_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
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
        and not exists (
          select 1
          from public.thread_comment_hides
          where thread_comment_hides.comment_id = thread_comments.id
        )
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
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
        and public.current_user_can_interact_with_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
    )
  );
