create index stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

create index stripe_webhook_events_event_type_received_at_idx
  on public.stripe_webhook_events (event_type, received_at desc);
