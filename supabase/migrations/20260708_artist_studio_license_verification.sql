insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'license-documents',
  'license-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.license_verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_type public.account_type not null,
  license_name text not null check (char_length(license_name) between 2 and 160),
  license_number text check (license_number is null or char_length(license_number) <= 120),
  issuing_region text not null check (char_length(issuing_region) between 2 and 120),
  expires_on date,
  storage_bucket text not null default 'license-documents',
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.license_verification_requests enable row level security;

drop policy if exists "Users can submit own license verification" on public.license_verification_requests;
create policy "Users can submit own license verification"
  on public.license_verification_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and account_type in ('artist', 'studio')
  );

drop policy if exists "Users can view own license verification" on public.license_verification_requests;
create policy "Users can view own license verification"
  on public.license_verification_requests for select
  to authenticated
  using (
    (select auth.uid()) = profile_id
    or private.current_user_can_moderate()
  );

drop policy if exists "Moderators can update license verification" on public.license_verification_requests;
create policy "Moderators can update license verification"
  on public.license_verification_requests for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

create index if not exists license_verification_profile_created_idx
  on public.license_verification_requests (profile_id, created_at desc);

create index if not exists license_verification_status_created_idx
  on public.license_verification_requests (status, created_at desc);

grant select, insert, update on public.license_verification_requests to authenticated;

drop policy if exists "License documents can be read by owner or moderators" on storage.objects;
create policy "License documents can be read by owner or moderators"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.current_user_can_moderate()
    )
  );

drop policy if exists "Users can upload own license documents" on storage.objects;
create policy "Users can upload own license documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'license-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can replace own license documents" on storage.objects;
create policy "Users can replace own license documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'license-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own license documents" on storage.objects;
create policy "Users can delete own license documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
