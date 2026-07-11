alter table public.profiles
  add column if not exists tiktok_url text,
  add column if not exists facebook_url text,
  add column if not exists youtube_url text,
  add column if not exists x_url text;

alter table public.profiles
  drop constraint if exists profiles_social_url_length_check;

alter table public.profiles
  add constraint profiles_social_url_length_check
  check (
    (tiktok_url is null or char_length(tiktok_url) <= 240)
    and (facebook_url is null or char_length(facebook_url) <= 240)
    and (youtube_url is null or char_length(youtube_url) <= 240)
    and (x_url is null or char_length(x_url) <= 240)
  );
