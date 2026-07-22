create or replace function private.profile_can_receive_content_tag(
  target_profile_id uuid,
  actor_profile_id uuid,
  content_owner_id uuid,
  content_visibility public.content_visibility,
  content_is_sensitive boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles target
    where target.id = target_profile_id
      and target.banned_at is null
      and target.suspended_at is null
      and (
        target_profile_id = content_owner_id
        or not content_is_sensitive
        or (
          target.is_adult_confirmed
          and target.adult_terms_accepted_at is not null
        )
      )
      and not exists (
        select 1
        from public.user_blocks blocked
        where (
          blocked.blocker_id = target_profile_id
          and blocked.blocked_id in (actor_profile_id, content_owner_id)
        )
        or (
          blocked.blocked_id = target_profile_id
          and blocked.blocker_id in (actor_profile_id, content_owner_id)
        )
      )
      and (
        target_profile_id = content_owner_id
        or content_visibility in ('public_preview', 'members')
        or (
          content_visibility = 'followers'
          and exists (
            select 1
            from public.follows
            where follows.follower_id = target_profile_id
              and follows.following_id = content_owner_id
              and follows.status = 'accepted'
          )
        )
        or (
          content_visibility = 'verified_artists_shops'
          and target.account_type in ('artist', 'studio')
          and target.license_verified_at is not null
        )
        or (
          content_visibility = 'verified_professionals'
          and target.account_type in ('artist', 'vendor')
          and target.license_verified_at is not null
        )
      )
  );
$$;

revoke all on function private.profile_can_receive_content_tag(
  uuid,
  uuid,
  uuid,
  public.content_visibility,
  boolean
) from public, anon;

grant execute on function private.profile_can_receive_content_tag(
  uuid,
  uuid,
  uuid,
  public.content_visibility,
  boolean
) to authenticated, service_role;

delete from public.notifications notification
where notification.type = 'feed_tag'
  and notification.subject_type = 'feed_post'
  and exists (
    select 1
    from public.feed_post_tags tag
    join public.feed_posts post on post.id = tag.post_id
    where tag.post_id = notification.subject_id
      and tag.tagged_profile_id = notification.recipient_id
      and not (
        post.is_published
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          tag.tagged_profile_id,
          tag.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
      )
  );

delete from public.notifications notification
where notification.type = 'thread_tag'
  and notification.subject_type = 'thread_post'
  and exists (
    select 1
    from public.thread_post_tags tag
    join public.thread_posts post on post.id = tag.thread_id
    where tag.thread_id = notification.subject_id
      and tag.tagged_profile_id = notification.recipient_id
      and not (
        post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          tag.tagged_profile_id,
          tag.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
      )
  );

delete from public.notifications notification
where notification.type = 'gig_tag'
  and notification.subject_type = 'gig'
  and exists (
    select 1
    from public.gig_tags tag
    join public.gigs gig on gig.id = tag.gig_id
    where tag.gig_id = notification.subject_id
      and tag.tagged_profile_id = notification.recipient_id
      and not (
        gig.status = 'active'
        and gig.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          tag.tagged_profile_id,
          tag.tagged_by,
          gig.poster_id,
          gig.visibility,
          gig.is_sensitive
        )
      )
  );

delete from public.notifications notification
where notification.type = 'feed_comment_tag'
  and notification.subject_type = 'post_comment'
  and exists (
    select 1
    from public.post_comment_tags tag
    join public.post_comments comment on comment.id = tag.comment_id
    join public.feed_posts post on post.id = comment.post_id
    where tag.comment_id = notification.subject_id
      and tag.tagged_profile_id = notification.recipient_id
      and not (
        comment.deleted_at is null
        and post.is_published
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          tag.tagged_profile_id,
          tag.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
      )
  );

delete from public.notifications notification
where notification.type = 'thread_comment_tag'
  and notification.subject_type = 'thread_comment'
  and exists (
    select 1
    from public.thread_comment_tags tag
    join public.thread_comments comment on comment.id = tag.comment_id
    join public.thread_posts post on post.id = comment.thread_id
    where tag.comment_id = notification.subject_id
      and tag.tagged_profile_id = notification.recipient_id
      and not (
        comment.deleted_at is null
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          tag.tagged_profile_id,
          tag.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
      )
  );

delete from public.feed_post_tags tag
using public.feed_posts post
where post.id = tag.post_id
  and not (
    post.is_published
    and post.moderation_status = 'active'
    and private.profile_can_receive_content_tag(
      tag.tagged_profile_id,
      tag.tagged_by,
      post.author_id,
      post.visibility,
      post.is_sensitive
    )
  );

delete from public.thread_post_tags tag
using public.thread_posts post
where post.id = tag.thread_id
  and not (
    post.moderation_status = 'active'
    and private.profile_can_receive_content_tag(
      tag.tagged_profile_id,
      tag.tagged_by,
      post.author_id,
      post.visibility,
      post.is_sensitive
    )
  );

delete from public.gig_tags tag
using public.gigs gig
where gig.id = tag.gig_id
  and not (
    gig.status = 'active'
    and gig.moderation_status = 'active'
    and private.profile_can_receive_content_tag(
      tag.tagged_profile_id,
      tag.tagged_by,
      gig.poster_id,
      gig.visibility,
      gig.is_sensitive
    )
  );

delete from public.post_comment_tags tag
using public.post_comments comment, public.feed_posts post
where comment.id = tag.comment_id
  and post.id = comment.post_id
  and not (
    comment.deleted_at is null
    and post.is_published
    and post.moderation_status = 'active'
    and private.profile_can_receive_content_tag(
      tag.tagged_profile_id,
      tag.tagged_by,
      post.author_id,
      post.visibility,
      post.is_sensitive
    )
  );

delete from public.thread_comment_tags tag
using public.thread_comments comment, public.thread_posts post
where comment.id = tag.comment_id
  and post.id = comment.thread_id
  and not (
    comment.deleted_at is null
    and post.moderation_status = 'active'
    and private.profile_can_receive_content_tag(
      tag.tagged_profile_id,
      tag.tagged_by,
      post.author_id,
      post.visibility,
      post.is_sensitive
    )
  );

drop policy if exists "Authors tag own feed posts" on public.feed_post_tags;
create policy "Authors tag eligible members in own feed posts"
  on public.feed_post_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.feed_posts post
      where post.id = feed_post_tags.post_id
        and post.author_id = (select auth.uid())
        and post.is_published
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          feed_post_tags.tagged_profile_id,
          feed_post_tags.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
    )
  );

drop policy if exists "Authors tag own thread posts" on public.thread_post_tags;
create policy "Authors tag eligible members in own thread posts"
  on public.thread_post_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.thread_posts post
      where post.id = thread_post_tags.thread_id
        and post.author_id = (select auth.uid())
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          thread_post_tags.tagged_profile_id,
          thread_post_tags.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
    )
  );

drop policy if exists "Authors tag own gigs" on public.gig_tags;
create policy "Authors tag eligible members in own gigs"
  on public.gig_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.gigs gig
      where gig.id = gig_tags.gig_id
        and gig.poster_id = (select auth.uid())
        and gig.status = 'active'
        and gig.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          gig_tags.tagged_profile_id,
          gig_tags.tagged_by,
          gig.poster_id,
          gig.visibility,
          gig.is_sensitive
        )
    )
  );

drop policy if exists "Authors tag own post comments" on public.post_comment_tags;
create policy "Authors tag eligible members in own post comments"
  on public.post_comment_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.post_comments comment
      join public.feed_posts post on post.id = comment.post_id
      where comment.id = post_comment_tags.comment_id
        and comment.author_id = (select auth.uid())
        and comment.deleted_at is null
        and post.is_published
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          post_comment_tags.tagged_profile_id,
          post_comment_tags.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
    )
  );

drop policy if exists "Authors tag own thread comments" on public.thread_comment_tags;
create policy "Authors tag eligible members in own thread comments"
  on public.thread_comment_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.thread_comments comment
      join public.thread_posts post on post.id = comment.thread_id
      where comment.id = thread_comment_tags.comment_id
        and comment.author_id = (select auth.uid())
        and comment.deleted_at is null
        and post.moderation_status = 'active'
        and private.profile_can_receive_content_tag(
          thread_comment_tags.tagged_profile_id,
          thread_comment_tags.tagged_by,
          post.author_id,
          post.visibility,
          post.is_sensitive
        )
    )
  );
