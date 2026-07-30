-- Keep repeated privileged commerce submissions from duplicating state,
-- financial effects, or immutable audit events.

alter table public.admin_audit_logs
  add column if not exists operation_key text;

create unique index if not exists admin_audit_logs_operation_key_uidx
  on public.admin_audit_logs (operation_key)
  where operation_key is not null;

alter table public.ad_credit_ledger
  add column if not exists operation_id uuid;

alter table public.ad_credit_ledger
  alter column operation_id set default gen_random_uuid();

create unique index if not exists ad_credit_ledger_operation_id_uidx
  on public.ad_credit_ledger (operation_id);

drop policy if exists "Admins can create ad credits" on public.ad_credit_ledger;
revoke insert on public.ad_credit_ledger from authenticated;

create or replace function public.grant_admin_ad_credit(
  p_operation_id uuid,
  p_profile_id uuid,
  p_amount_cents integer,
  p_credit_reason text,
  p_note text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_credit_id uuid;
begin
  if v_actor_id is null or not private.current_user_can_admin() then
    raise insufficient_privilege using message = 'Admin access required.';
  end if;

  if
    p_operation_id is null
    or p_profile_id is null
    or p_amount_cents <= 0
    or p_credit_reason not in ('promo', 'trade', 'sponsor', 'makegood', 'other')
  then
    raise invalid_parameter_value using message = 'Invalid ad credit request.';
  end if;

  insert into public.ad_credit_ledger (
    operation_id,
    profile_id,
    actor_id,
    amount_cents,
    credit_reason,
    note,
    expires_at
  )
  values (
    p_operation_id,
    p_profile_id,
    v_actor_id,
    p_amount_cents,
    p_credit_reason,
    left(nullif(trim(p_note), ''), 500),
    p_expires_at
  )
  on conflict (operation_id) do nothing
  returning id into v_credit_id;

  if v_credit_id is null then
    return false;
  end if;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    operation_key,
    summary,
    target_id,
    target_type
  )
  values (
    v_actor_id,
    'user_ad_credit_granted',
    jsonb_build_object(
      'amount_cents', p_amount_cents,
      'expires_at', p_expires_at,
      'reason', p_credit_reason
    ),
    'user-ad-credit-v1:' || p_operation_id::text,
    left(nullif(trim(p_note), ''), 500),
    p_profile_id,
    'profile'
  );

  return true;
end;
$$;

create or replace function public.admin_update_ad_campaign_status(
  p_campaign_id uuid,
  p_expected_status public.ad_campaign_status,
  p_status public.ad_campaign_status,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_campaign public.ad_campaigns%rowtype;
begin
  if v_actor_id is null or not private.current_user_can_moderate() then
    raise insufficient_privilege using message = 'Moderator access required.';
  end if;

  select *
  into v_campaign
  from public.ad_campaigns
  where id = p_campaign_id
  for update;

  if
    not found
    or v_campaign.status <> p_expected_status
    or v_campaign.status = p_status
  then
    return false;
  end if;

  if
    p_status = 'active'
    and (
      v_campaign.payment_dispute_hold
      or v_campaign.payment_status not in ('paid', 'waived')
    )
  then
    raise check_violation using message = 'Campaign payment is not eligible.';
  end if;

  update public.ad_campaigns
  set
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    reviewer_note = left(nullif(trim(p_note), ''), 500),
    status = p_status,
    updated_at = now()
  where id = v_campaign.id;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    summary,
    target_id,
    target_type
  )
  values (
    v_actor_id,
    'ad_campaign_' || p_status::text,
    jsonb_build_object(
      'campaign_type', v_campaign.campaign_type,
      'from_status', v_campaign.status,
      'goal', v_campaign.goal,
      'to_status', p_status
    ),
    left(nullif(trim(p_note), ''), 500),
    v_campaign.id,
    'ad_campaign'
  );

  return true;
end;
$$;

create or replace function public.admin_grant_ad_campaign_credit(
  p_campaign_id uuid,
  p_expected_payment_status text,
  p_expected_prepaid_amount_cents integer,
  p_credit_amount_cents integer,
  p_credit_reason text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_campaign public.ad_campaigns%rowtype;
begin
  if v_actor_id is null or not private.current_user_can_admin() then
    raise insufficient_privilege using message = 'Admin access required.';
  end if;

  if
    p_credit_amount_cents <= 0
    or p_credit_reason not in ('promo', 'trade', 'sponsor', 'makegood', 'other')
  then
    raise invalid_parameter_value using message = 'Invalid campaign credit.';
  end if;

  select *
  into v_campaign
  from public.ad_campaigns
  where id = p_campaign_id
  for update;

  if
    not found
    or v_campaign.payment_status <> p_expected_payment_status
    or v_campaign.prepaid_amount_cents <> p_expected_prepaid_amount_cents
    or (
      v_campaign.payment_status = 'waived'
      and v_campaign.prepaid_amount_cents = p_credit_amount_cents
    )
  then
    return false;
  end if;

  if v_campaign.payment_status in ('paid', 'checkout_started') then
    raise check_violation using message = 'Campaign payment is not eligible.';
  end if;

  update public.ad_campaigns
  set
    payment_status = 'waived',
    platform_fee_cents = 0,
    prepaid_amount_cents = p_credit_amount_cents,
    reviewer_note = coalesce(
      left(nullif(trim(p_note), ''), 500),
      'Ad credit applied.'
    ),
    updated_at = now()
  where id = v_campaign.id;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    summary,
    target_id,
    target_type
  )
  values (
    v_actor_id,
    'ad_campaign_credit_granted',
    jsonb_build_object(
      'campaign_type', v_campaign.campaign_type,
      'credit_amount_cents', p_credit_amount_cents,
      'from_payment_status', v_campaign.payment_status,
      'goal', v_campaign.goal,
      'reason', p_credit_reason
    ),
    coalesce(
      left(nullif(trim(p_note), ''), 500),
      'Manual ad credit granted for ' || p_credit_reason || '.'
    ),
    v_campaign.id,
    'ad_campaign'
  );

  return true;
end;
$$;

create or replace function public.admin_update_merch_product_status(
  p_product_id uuid,
  p_expected_status public.merch_product_status,
  p_status public.merch_product_status,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_product public.merch_products%rowtype;
begin
  if v_actor_id is null or not private.current_user_can_moderate() then
    raise insufficient_privilege using message = 'Moderator access required.';
  end if;

  select *
  into v_product
  from public.merch_products
  where id = p_product_id
  for update;

  if
    not found
    or v_product.status <> p_expected_status
    or v_product.status = p_status
  then
    return false;
  end if;

  update public.merch_products
  set
    reviewed_at = now(),
    reviewed_by = v_actor_id,
    reviewer_note = left(nullif(trim(p_note), ''), 500),
    status = p_status,
    updated_at = now()
  where id = v_product.id;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    summary,
    target_id,
    target_type
  )
  values (
    v_actor_id,
    'merch_product_' || p_status::text,
    jsonb_build_object(
      'category', v_product.category,
      'currency', v_product.currency,
      'from_status', v_product.status,
      'price_cents', v_product.price_cents,
      'to_status', p_status
    ),
    left(nullif(trim(p_note), ''), 500),
    v_product.id,
    'merch_product'
  );

  return true;
end;
$$;

create or replace function public.admin_update_merch_order_status(
  p_order_id uuid,
  p_status public.merch_order_status,
  p_admin_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_cancelled_order record;
  v_order public.merch_orders%rowtype;
begin
  if v_actor_id is null or not private.current_user_can_admin() then
    raise insufficient_privilege using message = 'Admin access required.';
  end if;

  if p_status not in ('fulfilled', 'cancelled') then
    raise invalid_parameter_value using message = 'Invalid order status.';
  end if;

  select *
  into v_order
  from public.merch_orders
  where id = p_order_id
  for update;

  if not found or v_order.status = p_status then
    return false;
  end if;

  if p_status = 'fulfilled' then
    if v_order.status <> 'paid' then
      raise check_violation using message = 'Only paid orders can be fulfilled.';
    end if;

    update public.merch_orders
    set
      admin_note = left(nullif(trim(p_admin_note), ''), 1000),
      fulfilled_at = now(),
      status = 'fulfilled',
      updated_at = now()
    where id = v_order.id;

    update public.merch_order_items
    set fulfillment_status = 'fulfilled'
    where order_id = v_order.id;
  else
    if
      v_order.status <> 'payment_failed'
      or v_order.inventory_reservation_status <> 'released'
    then
      raise check_violation using message = 'Only released failed orders can be cancelled.';
    end if;

    select *
    into v_cancelled_order
    from public.cancel_unpaid_merch_order(v_order.id, p_admin_note);

    if v_cancelled_order.id is null then
      return false;
    end if;
  end if;

  insert into public.admin_audit_logs (
    actor_id,
    event_type,
    metadata,
    operation_key,
    summary,
    target_id,
    target_type
  )
  values (
    v_actor_id,
    'merch_order_' || p_status::text,
    jsonb_build_object(
      'currency', v_order.currency,
      'from_status', v_order.status,
      'to_status', p_status,
      'total_cents', v_order.total_cents
    ),
    'merch-order-' || p_status::text || '-v1:' || v_order.id::text,
    left(nullif(trim(p_admin_note), ''), 500),
    v_order.id,
    'merch_order'
  )
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.grant_admin_ad_credit(
  uuid,
  uuid,
  integer,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.grant_admin_ad_credit(
  uuid,
  uuid,
  integer,
  text,
  text,
  timestamptz
) to authenticated;

revoke all on function public.admin_update_ad_campaign_status(
  uuid,
  public.ad_campaign_status,
  public.ad_campaign_status,
  text
) from public, anon, authenticated;
grant execute on function public.admin_update_ad_campaign_status(
  uuid,
  public.ad_campaign_status,
  public.ad_campaign_status,
  text
) to authenticated;

revoke all on function public.admin_grant_ad_campaign_credit(
  uuid,
  text,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.admin_grant_ad_campaign_credit(
  uuid,
  text,
  integer,
  integer,
  text,
  text
) to authenticated;

revoke all on function public.admin_update_merch_product_status(
  uuid,
  public.merch_product_status,
  public.merch_product_status,
  text
) from public, anon, authenticated;
grant execute on function public.admin_update_merch_product_status(
  uuid,
  public.merch_product_status,
  public.merch_product_status,
  text
) to authenticated;

revoke all on function public.admin_update_merch_order_status(
  uuid,
  public.merch_order_status,
  text
) from public, anon, authenticated;
grant execute on function public.admin_update_merch_order_status(
  uuid,
  public.merch_order_status,
  text
) to authenticated;
