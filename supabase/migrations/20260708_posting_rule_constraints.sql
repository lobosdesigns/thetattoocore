alter table public.feed_posts
  drop constraint if exists feed_posts_caption_word_limit_check;

alter table public.feed_posts
  add constraint feed_posts_caption_word_limit_check
  check (
    caption is null
    or cardinality(regexp_split_to_array(trim(caption), '\s+')) <= 40
  );

alter table public.post_comments
  drop constraint if exists post_comments_body_check,
  drop constraint if exists post_comments_body_word_limit_check;

alter table public.post_comments
  add constraint post_comments_body_word_limit_check
  check (
    char_length(body) between 1 and 500
    and cardinality(regexp_split_to_array(trim(body), '\s+')) <= 40
  );

alter table public.thread_posts
  drop constraint if exists thread_posts_body_check;

alter table public.thread_posts
  add constraint thread_posts_body_check
  check (char_length(body) between 1 and 8000);

alter table public.thread_comments
  drop constraint if exists thread_comments_body_check;

alter table public.thread_comments
  add constraint thread_comments_body_check
  check (char_length(body) between 1 and 2000);
