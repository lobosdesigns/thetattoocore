alter table public.stripe_connect_accounts
  add column if not exists livemode boolean;

-- Existing rows predate mode tracking, so their readiness cannot be trusted.
update public.stripe_connect_accounts
set
  charges_enabled = false,
  payouts_enabled = false,
  details_submitted = false,
  onboarding_completed_at = null,
  updated_at = now()
where livemode is null;

alter table public.stripe_connect_accounts
  drop constraint if exists stripe_connect_accounts_livemode_readiness_check;

alter table public.stripe_connect_accounts
  add constraint stripe_connect_accounts_livemode_readiness_check
  check (
    livemode is not null
    or (
      not charges_enabled
      and not payouts_enabled
      and not details_submitted
      and onboarding_completed_at is null
    )
  );

drop index if exists public.stripe_connect_accounts_status_idx;
create index stripe_connect_accounts_status_idx
  on public.stripe_connect_accounts (
    livemode,
    charges_enabled,
    payouts_enabled,
    details_submitted,
    updated_at desc
  );

comment on column public.stripe_connect_accounts.livemode is
  'Payment mode that produced this connected-account readiness state.';
