create or replace function public.spend_ad_credit_for_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available_cents integer := 0;
  v_campaign public.ad_campaigns%rowtype;
  v_credit record;
  v_needed_cents integer := 0;
  v_now timestamptz := now();
  v_remaining_cents integer := 0;
  v_use_cents integer := 0;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;

  select *
  into v_campaign
  from public.ad_campaigns
  where id = p_campaign_id
    and advertiser_id = v_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_campaign.status not in ('pending_review', 'approved', 'paused') then
    return false;
  end if;

  if v_campaign.payment_status not in ('unpaid', 'payment_failed', 'refunded') then
    return false;
  end if;

  if v_campaign.daily_budget_cents <= 0 then
    return false;
  end if;

  v_needed_cents := v_campaign.daily_budget_cents;

  perform 1
  from public.ad_credit_ledger
  where profile_id = v_user_id
    and status = 'active'
    and amount_cents > used_cents
    and (expires_at is null or expires_at >= v_now)
  for update;

  select coalesce(sum(amount_cents - used_cents), 0)::integer
  into v_available_cents
  from public.ad_credit_ledger
  where profile_id = v_user_id
    and status = 'active'
    and amount_cents > used_cents
    and (expires_at is null or expires_at >= v_now);

  if v_available_cents < v_needed_cents then
    return false;
  end if;

  v_remaining_cents := v_needed_cents;

  for v_credit in
    select id, amount_cents, used_cents
    from public.ad_credit_ledger
    where profile_id = v_user_id
      and status = 'active'
      and amount_cents > used_cents
      and (expires_at is null or expires_at >= v_now)
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    v_use_cents := least(v_remaining_cents, v_credit.amount_cents - v_credit.used_cents);

    update public.ad_credit_ledger
    set
      used_cents = used_cents + v_use_cents,
      status = case
        when used_cents + v_use_cents >= amount_cents then 'spent'
        else status
      end,
      updated_at = v_now
    where id = v_credit.id;

    v_remaining_cents := v_remaining_cents - v_use_cents;
    exit when v_remaining_cents <= 0;
  end loop;

  update public.ad_campaigns
  set
    payment_status = 'waived',
    platform_fee_cents = 0,
    prepaid_amount_cents = v_needed_cents,
    stripe_checkout_session_id = null,
    reviewer_note = left(
      concat_ws(E'\n', nullif(reviewer_note, ''), 'Ad credit balance applied.'),
      500
    ),
    updated_at = v_now
  where id = v_campaign.id
    and advertiser_id = v_user_id
    and payment_status in ('unpaid', 'payment_failed', 'refunded');

  return found;
end;
$$;

revoke all on function public.spend_ad_credit_for_campaign(uuid) from public;
grant execute on function public.spend_ad_credit_for_campaign(uuid) to authenticated;
grant execute on function public.spend_ad_credit_for_campaign(uuid) to service_role;
