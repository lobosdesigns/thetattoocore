create table if not exists public.ad_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  used_cents integer not null default 0 check (used_cents >= 0),
  credit_reason text not null default 'promo'
    check (credit_reason in ('promo', 'trade', 'sponsor', 'makegood', 'other')),
  note text,
  status text not null default 'active'
    check (status in ('active', 'voided', 'expired', 'spent')),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (used_cents <= amount_cents)
);

alter table public.ad_credit_ledger enable row level security;

create policy "Users can view own ad credits"
  on public.ad_credit_ledger for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "Admins can view ad credits"
  on public.ad_credit_ledger for select
  to authenticated
  using (private.current_user_can_admin());

create policy "Admins can create ad credits"
  on public.ad_credit_ledger for insert
  to authenticated
  with check (private.current_user_can_admin() and actor_id = (select auth.uid()));

create policy "Admins can update ad credits"
  on public.ad_credit_ledger for update
  to authenticated
  using (private.current_user_can_admin())
  with check (private.current_user_can_admin());

grant select on public.ad_credit_ledger to authenticated;
grant insert, update on public.ad_credit_ledger to authenticated;
grant select, insert, update on public.ad_credit_ledger to service_role;

create index if not exists ad_credit_ledger_profile_idx
  on public.ad_credit_ledger (profile_id, status, created_at desc);

create index if not exists ad_credit_ledger_actor_idx
  on public.ad_credit_ledger (actor_id, created_at desc);
