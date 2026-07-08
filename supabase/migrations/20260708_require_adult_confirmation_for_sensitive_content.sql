drop policy if exists "Visible feed posts can be read" on public.feed_posts;
create policy "Visible feed posts can be read"
  on public.feed_posts for select
  using (
    is_published
    and moderation_status = 'active'
    and (
      (
        visibility = 'public_preview'
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
    )
  );

drop policy if exists "Visible feed media can be read" on public.feed_media;
create policy "Visible feed media can be read"
  on public.feed_media for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = feed_media.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Visible post likes can be read" on public.post_likes;
create policy "Visible post likes can be read"
  on public.post_likes for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_likes.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or feed_posts.author_id = (select auth.uid())
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
      select 1 from public.feed_posts
      where feed_posts.id = post_likes.post_id
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
          select 1 from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
    )
  );

drop policy if exists "Visible post comments can be read" on public.post_comments;
create policy "Visible post comments can be read"
  on public.post_comments for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_comments.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not feed_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or feed_posts.author_id = (select auth.uid())
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
      select 1 from public.feed_posts
      where feed_posts.id = post_comments.post_id
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
          select 1 from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
    )
  );

drop policy if exists "Visible thread posts can be read" on public.thread_posts;
create policy "Visible thread posts can be read"
  on public.thread_posts for select
  using (
    moderation_status = 'active'
    and (
      author_id = (select auth.uid())
      or (
        visibility = 'public_preview'
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
    )
  );

drop policy if exists "Thread media follows thread visibility" on public.thread_media;
create policy "Thread media follows thread visibility"
  on public.thread_media for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.author_id = (select auth.uid())
        or (
          thread_posts.visibility = 'public_preview'
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
      )
    )
  );

drop policy if exists "Visible thread likes can be read" on public.thread_likes;
create policy "Visible thread likes can be read"
  on public.thread_likes for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.author_id = (select auth.uid())
        or (
          thread_posts.visibility = 'public_preview'
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
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
      select 1 from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.visibility in ('public_preview', 'members')
        or thread_posts.author_id = (select auth.uid())
      )
      and (
        not thread_posts.is_sensitive
        or thread_posts.author_id = (select auth.uid())
        or exists (
          select 1 from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
    )
  );

drop policy if exists "Visible thread comments can be read" on public.thread_comments;
create policy "Visible thread comments can be read"
  on public.thread_comments for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_comments.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.author_id = (select auth.uid())
        or (
          thread_posts.visibility = 'public_preview'
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not thread_posts.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
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
      select 1 from public.thread_posts
      where thread_posts.id = thread_comments.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.visibility in ('public_preview', 'members')
        or thread_posts.author_id = (select auth.uid())
      )
      and (
        not thread_posts.is_sensitive
        or thread_posts.author_id = (select auth.uid())
        or exists (
          select 1 from public.profiles viewer
          where viewer.id = (select auth.uid())
          and viewer.is_adult_confirmed
          and viewer.adult_terms_accepted_at is not null
        )
      )
    )
  );

drop policy if exists "Visible marketplace listings can be read" on public.marketplace_listings;
create policy "Visible marketplace listings can be read"
  on public.marketplace_listings for select
  using (
    status = 'active'
    and moderation_status = 'active'
    and (
      seller_id = (select auth.uid())
      or (
        visibility = 'public_preview'
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
    )
  );

drop policy if exists "Marketplace media follows listing visibility" on public.marketplace_media;
create policy "Marketplace media follows listing visibility"
  on public.marketplace_media for select
  using (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.id = marketplace_media.listing_id
      and marketplace_listings.status = 'active'
      and marketplace_listings.moderation_status = 'active'
      and (
        marketplace_listings.seller_id = (select auth.uid())
        or (
          marketplace_listings.visibility = 'public_preview'
          and (
            not marketplace_listings.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          marketplace_listings.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not marketplace_listings.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
      )
    )
  );

drop policy if exists "Visible gigs can be read" on public.gigs;
create policy "Visible gigs can be read"
  on public.gigs for select
  using (
    status = 'active'
    and moderation_status = 'active'
    and (
      poster_id = (select auth.uid())
      or (
        visibility = 'public_preview'
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not is_sensitive
          or exists (
            select 1 from public.profiles viewer
            where viewer.id = (select auth.uid())
            and viewer.is_adult_confirmed
            and viewer.adult_terms_accepted_at is not null
          )
        )
      )
    )
  );

drop policy if exists "Gig media follows gig visibility" on public.gig_media;
create policy "Gig media follows gig visibility"
  on public.gig_media for select
  using (
    exists (
      select 1 from public.gigs
      where gigs.id = gig_media.gig_id
      and gigs.status = 'active'
      and gigs.moderation_status = 'active'
      and (
        gigs.poster_id = (select auth.uid())
        or (
          gigs.visibility = 'public_preview'
          and (
            not gigs.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
        or (
          gigs.visibility = 'members'
          and (select auth.uid()) is not null
          and (
            not gigs.is_sensitive
            or exists (
              select 1 from public.profiles viewer
              where viewer.id = (select auth.uid())
              and viewer.is_adult_confirmed
              and viewer.adult_terms_accepted_at is not null
            )
          )
        )
      )
    )
  );
