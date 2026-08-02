begin;

alter table public.merch_products
  add column if not exists external_checkout_url text,
  add column if not exists seller_checkout_terms_version text,
  add column if not exists seller_checkout_terms_accepted_at timestamptz;

alter table public.merch_products
  add constraint merch_products_external_checkout_url_shape
    check (
      external_checkout_url is null
      or (
        char_length(external_checkout_url) <= 500
        and external_checkout_url ~ '^https://buy[.]stripe[.]com/[A-Za-z0-9_]{1,255}$'
      )
    ),
  add constraint merch_products_seller_checkout_terms_consistency
    check (
      (seller_checkout_terms_version is null and seller_checkout_terms_accepted_at is null)
      or (
        external_checkout_url is not null
        and seller_checkout_terms_version = 'seller-checkout-v1'
        and seller_checkout_terms_accepted_at is not null
      )
    );

create or replace function private.protect_merch_seller_checkout_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trusted_writer boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
  protected_fields_changed boolean;
  checkout_terms_changed boolean := false;
  trusted_acceptance_requested boolean := false;
begin
  if tg_op = 'INSERT' then
    protected_fields_changed :=
      new.external_checkout_url is not null
      or new.seller_checkout_terms_version is not null
      or new.seller_checkout_terms_accepted_at is not null;
  else
    protected_fields_changed :=
      new.external_checkout_url is distinct from old.external_checkout_url
      or new.seller_checkout_terms_version is distinct from old.seller_checkout_terms_version
      or new.seller_checkout_terms_accepted_at is distinct from old.seller_checkout_terms_accepted_at;

    checkout_terms_changed :=
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.category is distinct from old.category
      or new.sku is distinct from old.sku
      or new.price_cents is distinct from old.price_cents
      or new.compare_at_price_cents is distinct from old.compare_at_price_cents
      or new.currency is distinct from old.currency
      or new.shipping_required is distinct from old.shipping_required
      or new.ships_from_country is distinct from old.ships_from_country
      or new.ships_from_region is distinct from old.ships_from_region
      or new.ships_from_city is distinct from old.ships_from_city
      or new.fulfillment_notes is distinct from old.fulfillment_notes
      or new.return_policy is distinct from old.return_policy;
  end if;

  if protected_fields_changed and not trusted_writer then
    raise exception using
      errcode = '42501',
      message = 'seller checkout fields may only be changed by a trusted server role';
  end if;

  if trusted_writer and protected_fields_changed then
    if new.external_checkout_url is null
      or new.seller_checkout_terms_version is null then
      new.seller_checkout_terms_version := null;
      new.seller_checkout_terms_accepted_at := null;
    elsif new.seller_checkout_terms_version = 'seller-checkout-v1' then
      new.seller_checkout_terms_accepted_at := statement_timestamp();
      trusted_acceptance_requested := true;
    end if;
  end if;

  if checkout_terms_changed and not trusted_acceptance_requested then
    new.seller_checkout_terms_version := null;
    new.seller_checkout_terms_accepted_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_merch_seller_checkout_fields()
  from public, anon, authenticated;

drop trigger if exists protect_merch_seller_checkout_fields
  on public.merch_products;

create trigger protect_merch_seller_checkout_fields
before insert or update on public.merch_products
for each row
execute function private.protect_merch_seller_checkout_fields();

revoke select on table public.merch_products from anon, authenticated;

do $$
declare
  safe_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'merch_products'
    and column_name not in (
      'external_checkout_url',
      'seller_checkout_terms_version',
      'seller_checkout_terms_accepted_at'
    );

  execute format(
    'grant select (%s) on table public.merch_products to anon, authenticated',
    safe_columns
  );
end;
$$;

grant select on table public.merch_products to service_role;

commit;
