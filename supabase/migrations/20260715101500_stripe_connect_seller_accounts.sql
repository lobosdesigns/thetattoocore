create table if not exists public.stripe_connect_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express' check (account_type in ('express', 'standard', 'custom')),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  default_currency text check (default_currency is null or default_currency ~ '^[a-z]{3}$'),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  disabled_reason text,
  requirements_currently_due jsonb not null default '[]'::jsonb,
  onboarding_started_at timestamptz,
  onboarding_completed_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_connect_accounts_id_shape check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  constraint stripe_connect_requirements_array check (jsonb_typeof(requirements_currently_due) = 'array')
);

alter table public.stripe_connect_accounts enable row level security;

revoke all on public.stripe_connect_accounts from anon;
grant select on public.stripe_connect_accounts to authenticated;
grant select, insert, update, delete on public.stripe_connect_accounts to service_role;

drop policy if exists "Owners can view own Stripe Connect account" on public.stripe_connect_accounts;
create policy "Owners can view own Stripe Connect account"
  on public.stripe_connect_accounts for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Moderators can view Stripe Connect accounts" on public.stripe_connect_accounts;
create policy "Moderators can view Stripe Connect accounts"
  on public.stripe_connect_accounts for select
  to authenticated
  using (private.current_user_can_moderate());

create index if not exists stripe_connect_accounts_status_idx
  on public.stripe_connect_accounts (charges_enabled, payouts_enabled, details_submitted, updated_at desc);

create index if not exists stripe_connect_accounts_updated_idx
  on public.stripe_connect_accounts (updated_at desc);
