create table public.stripe_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 120),
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_webhook_events from anon;
revoke all on public.stripe_webhook_events from authenticated;

grant select, insert on public.stripe_webhook_events to service_role;
