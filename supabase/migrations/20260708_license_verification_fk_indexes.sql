create index if not exists license_verification_requests_reviewer_idx
  on public.license_verification_requests (reviewer_id);

create index if not exists profiles_license_verification_request_idx
  on public.profiles (license_verification_request_id);

create index if not exists profiles_license_verified_by_idx
  on public.profiles (license_verified_by);
