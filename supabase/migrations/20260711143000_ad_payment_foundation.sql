alter table public.ad_campaigns
  add column if not exists payment_status text not null default 'unpaid'
    check (
      payment_status in (
        'unpaid',
        'checkout_started',
        'paid',
        'payment_failed',
        'refunded',
        'waived'
      )
    ),
  add column if not exists prepaid_amount_cents integer not null default 0
    check (prepaid_amount_cents >= 0),
  add column if not exists platform_fee_cents integer not null default 0
    check (platform_fee_cents >= 0),
  add column if not exists stripe_checkout_session_id text unique,
  add column if not exists stripe_payment_intent_id text unique,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_at timestamptz;

create index if not exists ad_campaigns_payment_status_idx
  on public.ad_campaigns (payment_status, created_at desc);
