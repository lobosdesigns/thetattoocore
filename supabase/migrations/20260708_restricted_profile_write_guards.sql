-- Block suspended or banned profiles from member-generated writes at the database layer.

create or replace function public.prevent_restricted_profile_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_id uuid;
  restricted_profile record;
begin
  if tg_nargs < 1 then
    raise exception 'Missing profile column argument.';
  end if;

  profile_id := nullif(to_jsonb(new)->>tg_argv[0], '')::uuid;

  if profile_id is null then
    return new;
  end if;

  select banned_at, suspended_at
    into restricted_profile
    from public.profiles
    where id = profile_id;

  if restricted_profile.banned_at is not null then
    raise exception 'This account is banned from member actions.';
  end if;

  if restricted_profile.suspended_at is not null then
    raise exception 'This account is suspended from member actions.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_restricted_profile_write() from public;

drop trigger if exists prevent_restricted_feed_posts on public.feed_posts;
create trigger prevent_restricted_feed_posts
before insert or update on public.feed_posts
for each row execute function public.prevent_restricted_profile_write('author_id');

drop trigger if exists prevent_restricted_post_likes on public.post_likes;
create trigger prevent_restricted_post_likes
before insert or update on public.post_likes
for each row execute function public.prevent_restricted_profile_write('user_id');

drop trigger if exists prevent_restricted_post_comments on public.post_comments;
create trigger prevent_restricted_post_comments
before insert or update on public.post_comments
for each row execute function public.prevent_restricted_profile_write('author_id');

drop trigger if exists prevent_restricted_thread_posts on public.thread_posts;
create trigger prevent_restricted_thread_posts
before insert or update on public.thread_posts
for each row execute function public.prevent_restricted_profile_write('author_id');

drop trigger if exists prevent_restricted_thread_likes on public.thread_likes;
create trigger prevent_restricted_thread_likes
before insert or update on public.thread_likes
for each row execute function public.prevent_restricted_profile_write('user_id');

drop trigger if exists prevent_restricted_thread_comments on public.thread_comments;
create trigger prevent_restricted_thread_comments
before insert or update on public.thread_comments
for each row execute function public.prevent_restricted_profile_write('author_id');

drop trigger if exists prevent_restricted_marketplace_listings on public.marketplace_listings;
create trigger prevent_restricted_marketplace_listings
before insert or update on public.marketplace_listings
for each row execute function public.prevent_restricted_profile_write('seller_id');

drop trigger if exists prevent_restricted_gigs on public.gigs;
create trigger prevent_restricted_gigs
before insert or update on public.gigs
for each row execute function public.prevent_restricted_profile_write('poster_id');

drop trigger if exists prevent_restricted_follows on public.follows;
create trigger prevent_restricted_follows
before insert or update on public.follows
for each row execute function public.prevent_restricted_profile_write('follower_id');

drop trigger if exists prevent_restricted_conversations on public.conversations;
create trigger prevent_restricted_conversations
before insert or update on public.conversations
for each row execute function public.prevent_restricted_profile_write('created_by');

drop trigger if exists prevent_restricted_conversation_members on public.conversation_members;
create trigger prevent_restricted_conversation_members
before insert or update on public.conversation_members
for each row execute function public.prevent_restricted_profile_write('user_id');

drop trigger if exists prevent_restricted_messages on public.messages;
create trigger prevent_restricted_messages
before insert or update on public.messages
for each row execute function public.prevent_restricted_profile_write('sender_id');

drop trigger if exists prevent_restricted_license_verifications on public.license_verification_requests;
create trigger prevent_restricted_license_verifications
before insert or update on public.license_verification_requests
for each row execute function public.prevent_restricted_profile_write('profile_id');
