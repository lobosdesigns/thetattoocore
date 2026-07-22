create or replace function public.reserve_booking_deposit_checkout(
  p_booking_id uuid,
  p_client_id uuid
)
returns setof public.booking_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.booking_requests%rowtype;
begin
  select booking.*
  into v_booking
  from public.booking_requests as booking
  join public.profiles as recipient
    on recipient.id = booking.artist_id
  where booking.id = p_booking_id
    and booking.client_id = p_client_id
    and booking.status = 'accepted'
    and booking.payment_status in ('not_ready', 'payment_failed')
    and booking.stripe_checkout_session_id is null
    and not booking.payment_dispute_hold
    and booking.deposit_amount_cents > 0
    and booking.total_cents > 0
    and recipient.account_type in ('artist', 'studio')
    and recipient.license_verified_at is not null
    and recipient.suspended_at is null
    and recipient.banned_at is null
    and (
      booking.shop_profile_id is null
      or (
        recipient.account_type = 'studio'
        and booking.shop_profile_id = recipient.id
      )
      or (
        recipient.account_type = 'artist'
        and recipient.shop_profile_id = booking.shop_profile_id
      )
    )
  for update of booking, recipient;

  if not found then
    return;
  end if;

  update public.booking_requests as booking
  set
    payment_status = 'checkout_started',
    status = 'deposit_pending',
    stripe_checkout_session_id = null,
    updated_at = now()
  where booking.id = v_booking.id
  returning booking.* into v_booking;

  return next v_booking;
end;
$$;

revoke all on function public.reserve_booking_deposit_checkout(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_booking_deposit_checkout(uuid, uuid)
  to service_role;
