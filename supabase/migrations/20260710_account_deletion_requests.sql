create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (
    status in ('pending', 'reviewing', 'completed', 'rejected', 'cancelled')
  ),
  reviewer_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint account_deletion_requests_reason_check
    check (reason is null or char_length(reason) <= 500),
  constraint account_deletion_requests_reviewer_note_check
    check (reviewer_note is null or char_length(reviewer_note) <= 500)
);

alter table public.account_deletion_requests enable row level security;

create unique index if not exists account_deletion_requests_one_pending_idx
  on public.account_deletion_requests (profile_id)
  where status in ('pending', 'reviewing');

create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests (status, requested_at desc);

drop policy if exists "Users can read own account deletion requests"
  on public.account_deletion_requests;
create policy "Users can read own account deletion requests"
  on public.account_deletion_requests for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Users can request own account deletion"
  on public.account_deletion_requests;
create policy "Users can request own account deletion"
  on public.account_deletion_requests for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "Admins can read account deletion requests"
  on public.account_deletion_requests;
create policy "Admins can read account deletion requests"
  on public.account_deletion_requests for select
  to authenticated
  using (private.current_user_can_admin());

drop policy if exists "Admins can review account deletion requests"
  on public.account_deletion_requests;
create policy "Admins can review account deletion requests"
  on public.account_deletion_requests for update
  to authenticated
  using (private.current_user_can_admin())
  with check (private.current_user_can_admin());

grant select, insert, update on public.account_deletion_requests to authenticated;
