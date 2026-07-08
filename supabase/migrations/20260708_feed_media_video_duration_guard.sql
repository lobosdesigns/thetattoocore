alter table public.feed_media
  drop constraint if exists feed_media_video_duration_check;

alter table public.feed_media
  add constraint feed_media_video_duration_check
  check (
    media_type <> 'video'
    or duration_seconds is null
    or duration_seconds <= 60
  );
