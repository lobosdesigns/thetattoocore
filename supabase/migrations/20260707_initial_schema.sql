-- TheTattooCore MVP schema for Supabase/Postgres.
-- Review before applying to production. RLS is enabled on public tables.

create extension if not exists pgcrypto;

create type public.account_type as enum ('artist', 'enthusiast', 'studio', 'supplier');
create type public.post_kind as enum ('photo', 'reel');
create type public.marketplace_status as enum ('draft', 'active', 'sold', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null,
  account_type public.account_type not null default 'enthusiast',
  bio text,
  avatar_url text,
  city text,
  region text,
  country text default 'US',
  website_url text,
  instagram_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind public.post_kind not null default 'photo',
  caption text,
  style_tags text[] not null default '{}',
  location_label text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feed_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  width integer,
  height integer,
  duration_seconds numeric(8,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.post_likes (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.thread_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.thread_posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'USD',
  status public.marketplace_status not null default 'draft',
  category text not null default 'flash',
  city text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.feed_posts enable row level security;
alter table public.feed_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.thread_posts enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_media enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Follows are public"
  on public.follows for select
  using (true);

create policy "Users can follow"
  on public.follows for insert
  to authenticated
  with check ((select auth.uid()) = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

create policy "Published feed posts are public"
  on public.feed_posts for select
  using (is_published);

create policy "Authors manage feed posts"
  on public.feed_posts for all
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Feed media is public for published posts"
  on public.feed_media for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = feed_media.post_id
      and feed_posts.is_published
    )
  );

create policy "Authors manage feed media"
  on public.feed_media for all
  to authenticated
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = feed_media.post_id
      and feed_posts.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = feed_media.post_id
      and feed_posts.author_id = (select auth.uid())
    )
  );

create policy "Likes are public"
  on public.post_likes for select
  using (true);

create policy "Users can like"
  on public.post_likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unlike"
  on public.post_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Comments are public"
  on public.post_comments for select
  using (true);

create policy "Users can comment"
  on public.post_comments for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users manage own comments"
  on public.post_comments for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Thread posts are public"
  on public.thread_posts for select
  using (true);

create policy "Users create thread posts"
  on public.thread_posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users update own thread posts"
  on public.thread_posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Active marketplace listings are public"
  on public.marketplace_listings for select
  using (status = 'active' or seller_id = (select auth.uid()));

create policy "Sellers manage listings"
  on public.marketplace_listings for all
  to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy "Marketplace media follows listing visibility"
  on public.marketplace_media for select
  using (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.id = marketplace_media.listing_id
      and (
        marketplace_listings.status = 'active'
        or marketplace_listings.seller_id = (select auth.uid())
      )
    )
  );

create policy "Sellers manage listing media"
  on public.marketplace_media for all
  to authenticated
  using (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.id = marketplace_media.listing_id
      and marketplace_listings.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.id = marketplace_media.listing_id
      and marketplace_listings.seller_id = (select auth.uid())
    )
  );

create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_members.conversation_id = conversations.id
      and conversation_members.user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (true);

create policy "Members can view members"
  on public.conversation_members for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = (select auth.uid())
    )
  );

create policy "Users can add themselves to conversations"
  on public.conversation_members for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Members can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_members.conversation_id = messages.conversation_id
      and conversation_members.user_id = (select auth.uid())
    )
  );

create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_members
      where conversation_members.conversation_id = messages.conversation_id
      and conversation_members.user_id = (select auth.uid())
    )
  );

create index profiles_username_idx on public.profiles (username);
create index follows_following_idx on public.follows (following_id);
create index feed_posts_author_created_idx on public.feed_posts (author_id, created_at desc);
create index feed_posts_created_idx on public.feed_posts (created_at desc);
create index feed_media_post_idx on public.feed_media (post_id, sort_order);
create index post_comments_post_created_idx on public.post_comments (post_id, created_at desc);
create index thread_posts_parent_created_idx on public.thread_posts (parent_id, created_at desc);
create index marketplace_status_created_idx on public.marketplace_listings (status, created_at desc);
create index conversation_members_user_idx on public.conversation_members (user_id);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

