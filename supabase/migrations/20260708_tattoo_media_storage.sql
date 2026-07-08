insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tattoo-media',
  'tattoo-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tattoo media is publicly readable"
  on storage.objects;
drop policy if exists "Users upload tattoo media to own folder"
  on storage.objects;
drop policy if exists "Users update own tattoo media"
  on storage.objects;
drop policy if exists "Users delete own tattoo media"
  on storage.objects;

create policy "Tattoo media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'tattoo-media');

create policy "Users upload tattoo media to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tattoo-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update own tattoo media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tattoo-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'tattoo-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete own tattoo media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tattoo-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
