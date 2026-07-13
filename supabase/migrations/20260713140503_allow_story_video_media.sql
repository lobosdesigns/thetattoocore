alter table public.story_media
  add column if not exists duration_seconds numeric(8,2);

alter table public.story_media
  drop constraint if exists story_media_media_type_check,
  drop constraint if exists story_media_metadata_check;

alter table public.story_media
  add constraint story_media_media_type_check
  check (media_type in ('image', 'video')),
  add constraint story_media_metadata_check
  check (
    (mime_type is null or char_length(mime_type) between 3 and 120)
    and (
      file_size_bytes is null
      or (
        media_type = 'image'
        and file_size_bytes between 1 and 10485760
      )
      or (
        media_type = 'video'
        and file_size_bytes between 1 and 26214400
      )
    )
    and (original_filename is null or char_length(original_filename) <= 180)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
    and (
      media_type <> 'video'
      or duration_seconds is null
      or duration_seconds <= 15
    )
  );
