revoke all on table public.booking_requests from anon, authenticated;

do $$
declare
  safe_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'booking_requests'
    and column_name not in (
      'admin_note',
      'stripe_application_fee_id',
      'stripe_checkout_session_id',
      'stripe_connected_account_id',
      'stripe_payment_intent_id'
    );

  execute format(
    'grant select (%s) on table public.booking_requests to authenticated',
    safe_columns
  );
end;
$$;

grant insert (
  appointment_type_id,
  appointment_type_label,
  artist_id,
  body,
  client_id,
  conversation_id,
  currency,
  deposit_amount_cents,
  fee_payer,
  payment_charge_model,
  payment_status,
  placement,
  platform_fee_cents,
  preferred_city,
  preferred_dates,
  preferred_slot_id,
  preferred_slot_label,
  shop_profile_id,
  status,
  style_tags,
  title,
  total_cents
) on table public.booking_requests to authenticated;

drop policy if exists "Members can request verified booking recipients"
  on public.booking_requests;
create policy "Members can request verified booking recipients"
  on public.booking_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = client_id
    and client_id <> artist_id
    and status = 'requested'
    and payment_status = 'not_ready'
    and currency = 'USD'
    and fee_payer = 'provider'
    and payment_charge_model = 'connected_direct'
    and deposit_amount_cents between 0 and 500000
    and (deposit_amount_cents = 0 or deposit_amount_cents >= 50)
    and platform_fee_cents = case
      when deposit_amount_cents = 0 then 0
      else (deposit_amount_cents * 2 + 99) / 100
    end
    and total_cents = deposit_amount_cents
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
    and stripe_connected_account_id is null
    and stripe_application_fee_id is null
    and paid_at is null
    and refunded_amount_cents = 0
    and refunded_platform_fee_cents = 0
    and not payment_dispute_hold
    and payment_dispute_status is null
    and payment_dispute_updated_at is null
    and exists (
      select 1
      from public.profiles as artist
      where artist.id = booking_requests.artist_id
        and artist.account_type in ('artist', 'studio')
        and artist.license_verified_at is not null
        and artist.suspended_at is null
        and artist.banned_at is null
        and (
          booking_requests.shop_profile_id is null
          or (
            artist.account_type = 'studio'
            and booking_requests.shop_profile_id = artist.id
          )
          or (
            artist.account_type = 'artist'
            and artist.shop_profile_id = booking_requests.shop_profile_id
          )
        )
    )
  );

revoke all on function private.protect_booking_connected_routing()
  from public, anon, authenticated;

comment on policy "Members can request verified booking recipients"
  on public.booking_requests is
  'Authenticated members may insert only initial provider-paid connected-direct booking requests. Payment state and provider routing remain server-owned.';

-- Rollback requires restoring the prior broad grants and insert policy from the
-- earlier booking migrations. Do not roll this hardening back while booking
-- payment routes are deployed.
