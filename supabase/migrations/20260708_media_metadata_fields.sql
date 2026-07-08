alter table public.feed_media
  add column if not exists mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists original_filename text;

alter table public.thread_media
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists original_filename text;

alter table public.marketplace_media
  add column if not exists media_type text not null default 'image',
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric(8,2),
  add column if not exists mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists original_filename text;

alter table public.gig_media
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric(8,2),
  add column if not exists mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists original_filename text;

alter table public.feed_media
  drop constraint if exists feed_media_metadata_check;

alter table public.feed_media
  add constraint feed_media_metadata_check
  check (
    (mime_type is null or char_length(mime_type) between 3 and 120)
    and (file_size_bytes is null or file_size_bytes between 1 and 52428800)
    and (original_filename is null or char_length(original_filename) <= 180)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
  );

alter table public.thread_media
  drop constraint if exists thread_media_metadata_check;

alter table public.thread_media
  add constraint thread_media_metadata_check
  check (
    (mime_type is null or char_length(mime_type) between 3 and 120)
    and (file_size_bytes is null or file_size_bytes between 1 and 10485760)
    and (original_filename is null or char_length(original_filename) <= 180)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
  );

alter table public.marketplace_media
  drop constraint if exists marketplace_media_type_check,
  drop constraint if exists marketplace_media_metadata_check,
  drop constraint if exists marketplace_media_video_duration_check;

alter table public.marketplace_media
  add constraint marketplace_media_type_check
  check (media_type in ('image', 'video')),
  add constraint marketplace_media_metadata_check
  check (
    (mime_type is null or char_length(mime_type) between 3 and 120)
    and (file_size_bytes is null or file_size_bytes between 1 and 52428800)
    and (original_filename is null or char_length(original_filename) <= 180)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
  ),
  add constraint marketplace_media_video_duration_check
  check (
    media_type <> 'video'
    or duration_seconds is null
    or duration_seconds <= 60
  );

alter table public.gig_media
  drop constraint if exists gig_media_metadata_check,
  drop constraint if exists gig_media_video_duration_check;

alter table public.gig_media
  add constraint gig_media_metadata_check
  check (
    (mime_type is null or char_length(mime_type) between 3 and 120)
    and (file_size_bytes is null or file_size_bytes between 1 and 52428800)
    and (original_filename is null or char_length(original_filename) <= 180)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
  ),
  add constraint gig_media_video_duration_check
  check (
    media_type <> 'video'
    or duration_seconds is null
    or duration_seconds <= 60
  );
