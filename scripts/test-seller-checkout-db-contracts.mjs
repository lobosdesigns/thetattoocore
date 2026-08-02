import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const root = process.cwd();
const pgData = mkdtempSync(path.join(tmpdir(), "ttc-seller-checkout-pg-"));
const port = await freePort();
let started = false;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

function pgEnv() {
  return {
    ...process.env,
    PGDATABASE: "postgres",
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
    PGUSER: "postgres",
  };
}

function runBin(bin, args, options = {}) {
  return execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    env: pgEnv(),
    stdio: options.input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function waitForPostgres() {
  let lastError = "";

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const output = runBin("pg_isready", [
        "-h",
        "127.0.0.1",
        "-p",
        String(port),
        "-d",
        "postgres",
      ]);

      if (output.includes("accepting connections")) return;
      lastError = output;
    } catch (error) {
      lastError = String(error.stdout ?? "") + String(error.stderr ?? "");
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }

  throw new Error("temporary PostgreSQL did not become ready: " + lastError);
}

function sql(text) {
  return runBin("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: text,
  });
}

function scalar(text) {
  return runBin("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
    input: text,
  }).trim();
}

function expectSqlError(text, pattern, label) {
  try {
    sql(text);
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    assert.match(output, pattern, label);
    return;
  }

  assert.fail(`${label}: expected SQL to fail`);
}

function migration(name) {
  return readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
}

function asRole(role, statements, userId = null) {
  const claims = userId
    ? `
      set request.jwt.claim.sub = '${userId}';
      set request.jwt.claim.role = 'authenticated';
    `
    : "";

  return `
    set role ${role};
    ${claims}
    ${statements}
  `;
}

function asUser(userId, statements) {
  return asRole("authenticated", statements, userId);
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const users = {
  seller: "00000000-0000-4000-8000-000000000201",
  otherSeller: "00000000-0000-4000-8000-000000000202",
};

const products = {
  seller: "20000000-0000-4000-8000-000000000001",
  otherSeller: "20000000-0000-4000-8000-000000000002",
  untrustedInsert: "20000000-0000-4000-8000-000000000003",
};

const validCheckoutUrl = "https://buy.stripe.com/a1B2_c3D4";
const alternateCheckoutUrl = "https://buy.stripe.com/Z9_y8X7";

try {
  runBin(
    "initdb",
    ["-D", pgData, "-U", "postgres", "--auth=trust", "--no-instructions"],
    { stdio: "ignore" },
  );
  runBin(
    "pg_ctl",
    ["-D", pgData, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"],
    { stdio: "ignore" },
  );
  started = true;
  waitForPostgres();

  sql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema private;
    create extension if not exists pgcrypto;

    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.profiles (
      id uuid primary key,
      account_type text not null,
      license_verified_at timestamptz,
      suspended_at timestamptz,
      banned_at timestamptz
    );

    create function private.current_user_can_moderate()
    returns boolean
    language sql
    security definer
    set search_path = ''
    stable
    as $$
      select false
    $$;

    create type public.merch_product_category as enum (
      'apparel',
      'print',
      'art',
      'sticker',
      'accessory',
      'official',
      'other'
    );

    create table public.merch_products (
      id uuid primary key default gen_random_uuid(),
      seller_id uuid not null references public.profiles(id) on delete cascade,
      title text not null,
      description text,
      category public.merch_product_category not null default 'other',
      status text not null default 'draft',
      moderation_status text not null default 'active',
      price_cents integer not null,
      compare_at_price_cents integer,
      currency text not null default 'USD',
      sku text,
      inventory_quantity integer not null default 0,
      inventory_reserved integer not null default 0,
      shipping_required boolean not null default true,
      ships_from_country text,
      ships_from_region text,
      ships_from_city text,
      fulfillment_notes text,
      return_policy text,
      is_official boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table public.merch_products enable row level security;

    create policy "Active merch products are publicly readable"
      on public.merch_products for select
      using (
        status = 'active'
        and moderation_status = 'active'
      );

    create policy "Sellers and moderators can view merch products"
      on public.merch_products for select
      to authenticated
      using (
        seller_id = (select auth.uid())
        or private.current_user_can_moderate()
      );

    create policy "Verified sellers can create merch products"
      on public.merch_products for insert
      to authenticated
      with check (
        seller_id = (select auth.uid())
        and status in ('draft', 'pending_review')
        and not is_official
        and exists (
          select 1
          from public.profiles seller
          where seller.id = (select auth.uid())
            and seller.license_verified_at is not null
            and seller.account_type in ('artist', 'studio', 'vendor')
        )
      );

    create policy "Verified sellers can update own non-live merch products"
      on public.merch_products for update
      to authenticated
      using (
        seller_id = (select auth.uid())
        and status in ('draft', 'pending_review', 'paused', 'rejected')
        and exists (
          select 1
          from public.profiles seller
          where seller.id = (select auth.uid())
            and seller.license_verified_at is not null
            and seller.account_type in ('artist', 'studio', 'vendor')
        )
      )
      with check (
        seller_id = (select auth.uid())
        and status in ('draft', 'pending_review', 'paused', 'rejected')
        and not is_official
        and exists (
          select 1
          from public.profiles seller
          where seller.id = (select auth.uid())
            and seller.license_verified_at is not null
            and seller.account_type in ('artist', 'studio', 'vendor')
        )
      );

    grant usage on schema public, auth, private to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function private.current_user_can_moderate() to authenticated;
    grant select on public.profiles to authenticated, service_role;
    grant select on public.merch_products to anon, authenticated;
    grant insert, update on public.merch_products to authenticated;

    insert into public.profiles (id, account_type, license_verified_at)
    values
      ('${users.seller}', 'artist', now()),
      ('${users.otherSeller}', 'studio', now());

    insert into public.merch_products (
      id, seller_id, title, description, category, status, moderation_status,
      price_cents, compare_at_price_cents, currency, sku, inventory_quantity,
      shipping_required, ships_from_country, ships_from_region, ships_from_city,
      fulfillment_notes, return_policy
    )
    values
      (
        '${products.seller}', '${users.seller}', 'Seller print', 'Archival art print.',
        'art', 'draft', 'active', 2500, 3000, 'USD', 'PRINT-1', 7, true,
        'US', 'TX', 'Austin', 'Ships in five business days.',
        'Returns accepted within thirty days.'
      ),
      (
        '${products.otherSeller}', '${users.otherSeller}', 'Studio shirt',
        'Cotton studio shirt.', 'apparel', 'active', 'active', 3500, null, 'USD',
        'SHIRT-1', 5, true, 'US', 'IL', 'Chicago', 'Ships in three business days.',
        'Unworn returns accepted within thirty days.'
      );
  `);

  sql(migration("20260802130000_seller_owned_merch_checkout.sql"));

  assert.equal(
    scalar(`
      select count(*)
      from public.merch_products
      where external_checkout_url is null
        and seller_checkout_terms_version is null
        and seller_checkout_terms_accepted_at is null;
    `),
    "2",
    "migration leaves every existing checkout field null without a backfill",
  );

  assert.equal(
    scalar(asRole("anon", `select id from public.merch_products where id = '${products.otherSeller}';`)),
    products.otherSeller,
    "anon can select a safe product column allowed by RLS",
  );
  assert.equal(
    scalar(asUser(users.seller, `select id from public.merch_products where id = '${products.seller}';`)),
    products.seller,
    "authenticated sellers can select a safe product column",
  );
  for (const roleQuery of [
    ["anon", asRole("anon", `select external_checkout_url from public.merch_products where id = '${products.seller}';`)],
    ["authenticated", asUser(users.seller, `select external_checkout_url from public.merch_products where id = '${products.seller}';`)],
  ]) {
    expectSqlError(
      roleQuery[1],
      /permission denied|42501/i,
      `${roleQuery[0]} cannot select the protected checkout URL`,
    );
  }
  for (const column of [
    "external_checkout_url",
    "seller_checkout_terms_version",
    "seller_checkout_terms_accepted_at",
  ]) {
    assert.equal(
      scalar(`select has_column_privilege('anon', 'public.merch_products', '${column}', 'select')::text;`),
      "false",
      `anon has no SELECT privilege on ${column}`,
    );
    assert.equal(
      scalar(`select has_column_privilege('authenticated', 'public.merch_products', '${column}', 'select')::text;`),
      "false",
      `authenticated has no SELECT privilege on ${column}`,
    );
    assert.equal(
      scalar(`select has_column_privilege('service_role', 'public.merch_products', '${column}', 'select')::text;`),
      "true",
      `service_role can select ${column}`,
    );
  }
  assert.equal(
    scalar(asRole("service_role", `select count(*) from public.merch_products where external_checkout_url is null;`)),
    "2",
    "service_role can read protected checkout columns",
  );
  for (const [privilege, expected] of [
    ["UPDATE", "true"],
    ["INSERT", "false"],
    ["DELETE", "false"],
  ]) {
    assert.equal(
      scalar(`
        select has_table_privilege(
          'service_role',
          'public.merch_products',
          '${privilege}'
        )::text;
      `),
      expected,
      `migration sets service_role ${privilege} privilege to ${expected}`,
    );
  }
  console.log("PASS zero-row backfill and least-privilege checkout reads");

  assert.equal(
    scalar(`
      select prosecdef::text
      from pg_proc
      where oid = 'private.protect_merch_seller_checkout_fields()'::regprocedure;
    `),
    "false",
    "checkout trigger function remains security invoker",
  );
  assert.equal(
    scalar(`
      select (proconfig = array['search_path=""']::text[])::text
      from pg_proc
      where oid = 'private.protect_merch_seller_checkout_fields()'::regprocedure;
    `),
    "true",
    "checkout trigger function has exactly one fixed empty search_path setting",
  );
  for (const role of ["public", "anon", "authenticated"]) {
    assert.equal(
      scalar(`
        select has_function_privilege(
          '${role}',
          'private.protect_merch_seller_checkout_fields()',
          'execute'
        )::text;
      `),
      "false",
      `${role} cannot execute the checkout trigger function`,
    );
  }

  expectSqlError(
    asUser(users.seller, `
      insert into public.merch_products (
        id,
        seller_id,
        title,
        category,
        price_cents,
        external_checkout_url,
        seller_checkout_terms_version,
        seller_checkout_terms_accepted_at
      )
      values (
        '${products.untrustedInsert}',
        '${users.seller}',
        'Protected insert attempt',
        'art',
        1800,
        '${validCheckoutUrl}',
        'seller-checkout-v1',
        '2035-01-01 00:00:00+00'
      );
    `),
    /permission denied|seller checkout fields|42501/i,
    "authenticated seller cannot insert valid protected checkout fields",
  );
  assert.equal(
    scalar(`select count(*) from public.merch_products where id = '${products.untrustedInsert}';`),
    "0",
    "denied authenticated protected insert leaves no row",
  );

  expectSqlError(
    asUser(users.seller, `
      update public.merch_products
      set external_checkout_url = '${validCheckoutUrl}'
      where id = '${products.seller}';
    `),
    /permission denied|seller checkout fields|42501/i,
    "seller cannot directly add a checkout URL",
  );

  assert.equal(
    scalar(asRole("service_role", `
    begin;
    select pg_sleep(1.1);
    update public.merch_products
    set external_checkout_url = '${validCheckoutUrl}',
        seller_checkout_terms_version = 'seller-checkout-v1',
        seller_checkout_terms_accepted_at = '2000-01-01 00:00:00+00',
        fulfillment_notes = 'Trusted server mixed-field update.'
    where id = '${products.seller}'
    returning
      (seller_checkout_terms_accepted_at = statement_timestamp())::text
      || ':' || (seller_checkout_terms_accepted_at > transaction_timestamp())::text
      || ':' || (
        seller_checkout_terms_accepted_at <> '2000-01-01 00:00:00+00'::timestamptz
      )::text;
    commit;
  `)),
    "true:true:true",
    "trusted mixed-field update uses statement time after transaction start and replaces caller time",
  );
  assert.equal(
    scalar(`
      select external_checkout_url || ':' || seller_checkout_terms_version || ':' || fulfillment_notes
      from public.merch_products
      where id = '${products.seller}';
    `),
    `${validCheckoutUrl}:seller-checkout-v1:Trusted server mixed-field update.`,
    "trusted write persists protected and commercial fields in one update",
  );

  const protectedSellerWrites = [
    ["replace", `external_checkout_url = '${alternateCheckoutUrl}'`],
    ["clear", "external_checkout_url = null"],
    ["version", "seller_checkout_terms_version = 'seller-checkout-v2'"],
    ["timestamp", "seller_checkout_terms_accepted_at = '2035-01-01 00:00:00+00'"],
  ];
  for (const [label, assignment] of protectedSellerWrites) {
    expectSqlError(
      asUser(users.seller, `
        update public.merch_products
        set ${assignment}
        where id = '${products.seller}';
      `),
      /permission denied|seller checkout fields|42501/i,
      `seller cannot directly ${label} protected checkout fields`,
    );
  }

  assert.equal(
    scalar(asUser(users.otherSeller, `
      update public.merch_products
      set title = 'Cross-owner overwrite'
      where id = '${products.seller}'
      returning id;
    `)),
    "",
    "a second seller cannot update another seller's row",
  );
  assert.equal(
    scalar(`select title from public.merch_products where id = '${products.seller}';`),
    "Seller print",
    "owner isolation leaves the first seller's product unchanged",
  );
  console.log("PASS role enforcement, owner isolation, and trusted timestamp ownership");

  const acceptanceInvalidators = [
    ["title", "title = 'Updated seller print'"],
    ["description", "description = 'Updated archival art print.'"],
    ["category", "category = 'print'"],
    ["sku", "sku = 'PRINT-2'"],
    ["price", "price_cents = 2600"],
    ["compare-at price", "compare_at_price_cents = 3200"],
    ["currency", "currency = 'CAD'"],
    ["shipping", "shipping_required = false"],
    ["ship-from country", "ships_from_country = 'CA'"],
    ["ship-from region", "ships_from_region = 'ON'"],
    ["ship-from city", "ships_from_city = 'Toronto'"],
    ["fulfillment", "fulfillment_notes = 'Ships in seven business days.'"],
    ["return terms", "return_policy = 'Final sale.'"],
  ];
  for (const [label, assignment] of acceptanceInvalidators) {
    sql(asRole("service_role", `
      update public.merch_products
      set external_checkout_url = '${validCheckoutUrl}',
          seller_checkout_terms_version = 'seller-checkout-v1'
      where id = '${products.seller}';
    `));
    assert.equal(
      scalar(`
        select (seller_checkout_terms_accepted_at is not null)::text
        from public.merch_products
        where id = '${products.seller}';
      `),
      "true",
      `trusted writer renews acceptance before the ${label} test`,
    );

    sql(asUser(users.seller, `
      update public.merch_products
      set ${assignment}
      where id = '${products.seller}';
    `));
    assert.equal(
      scalar(`
        select (
          external_checkout_url = '${validCheckoutUrl}'
          and seller_checkout_terms_version is null
          and seller_checkout_terms_accepted_at is null
        )::text
        from public.merch_products
        where id = '${products.seller}';
      `),
      "true",
      `${label} changes invalidate acceptance without deleting the checkout URL`,
    );
  }

  sql(asRole("service_role", `
    update public.merch_products
    set seller_checkout_terms_version = 'seller-checkout-v1'
    where id = '${products.seller}';
  `));
  const acceptedAtBeforeInventory = scalar(`
    select seller_checkout_terms_accepted_at::text
    from public.merch_products
    where id = '${products.seller}';
  `);
  sql(asUser(users.seller, `
    update public.merch_products
    set inventory_quantity = inventory_quantity + 1,
        status = 'paused'
    where id = '${products.seller}';
  `));
  assert.equal(
    scalar(`
      select inventory_quantity || ':' || status || ':' || seller_checkout_terms_accepted_at::text
      from public.merch_products
      where id = '${products.seller}';
    `),
    `8:paused:${acceptedAtBeforeInventory}`,
    "inventory and lifecycle status updates remain unchanged and do not invalidate acceptance",
  );

  sql(asRole("service_role", `
    update public.merch_products
    set external_checkout_url = null
    where id = '${products.seller}';
  `));
  assert.equal(
    scalar(`
      select (
        external_checkout_url is null
        and seller_checkout_terms_version is null
        and seller_checkout_terms_accepted_at is null
      )::text
      from public.merch_products
      where id = '${products.seller}';
    `),
    "true",
    "trusted URL clearing also clears acceptance",
  );

  sql(asRole("service_role", `
    update public.merch_products
    set external_checkout_url = '${validCheckoutUrl}',
        seller_checkout_terms_version = 'seller-checkout-v1'
    where id = '${products.seller}';
  `));
  sql(asRole("service_role", `
    update public.merch_products
    set seller_checkout_terms_version = null
    where id = '${products.seller}';
  `));
  assert.equal(
    scalar(`
      select (
        external_checkout_url = '${validCheckoutUrl}'
        and seller_checkout_terms_version is null
        and seller_checkout_terms_accepted_at is null
      )::text
      from public.merch_products
      where id = '${products.seller}';
    `),
    "true",
    "trusted terms-version clearing also clears acceptance",
  );
  console.log("PASS acceptance invalidation and trusted clearing behavior");

  const invalidCheckoutUrls = [
    ["empty URL", ""],
    ["javascript URL", "javascript:alert(1)"],
    ["data URL", "data:text/html,boom"],
    ["file URL", "file:///etc/passwd"],
    ["insecure Stripe URL", "http://buy.stripe.com/a1B2"],
    ["suffix host", "https://buy.stripe.com.evil.example/a1B2"],
    ["userinfo host confusion", "https://buy.stripe.com@evil.example/a1B2"],
    ["credentials", "https://user:pass@buy.stripe.com/a1B2"],
    ["custom port", "https://buy.stripe.com:444/a1B2"],
    ["query string", "https://buy.stripe.com/a1B2?email=victim@example.com"],
    ["fragment", "https://buy.stripe.com/a1B2#fragment"],
    ["missing path token", "https://buy.stripe.com/"],
    ["nested path", "https://buy.stripe.com/a/b"],
    ["trailing slash", "https://buy.stripe.com/a1B2/"],
    ["encoded path confusion", "https://buy.stripe.com/%2f%2fevil.example"],
    ["malformed percent escape", "https://buy.stripe.com/%ZZ"],
    ["CRLF injection", "https://buy.stripe.com/a1B2\r\nX-Test: injected"],
    ["Unicode lookalike host", "https://b\u0443y.stripe.com/a1B2"],
    ["punycode host", "https://xn--by-eka.stripe.com/a1B2"],
    ["lowercase test-mode identifier", "https://buy.stripe.com/test_123"],
    ["oversized path token", `https://buy.stripe.com/${"a".repeat(256)}`],
    ["over 500 characters", "x".repeat(501)],
    ["SQL quote payload", "https://buy.stripe.com/a1B2'; drop table public.merch_products; --"],
  ];
  for (const [label, value] of invalidCheckoutUrls) {
    expectSqlError(
      asRole("service_role", `
        update public.merch_products
        set external_checkout_url = ${quoteLiteral(value)},
            seller_checkout_terms_version = 'seller-checkout-v1',
            seller_checkout_terms_accepted_at = '2000-01-01 00:00:00+00'
        where id = '${products.seller}';
      `),
      /merch_products_external_checkout_url_shape|check constraint|23514/i,
      `${label} fails the database URL constraint`,
    );
  }
  assert.equal(
    scalar("select to_regclass('public.merch_products')::text;"),
    "merch_products",
    "malicious SQL-shaped checkout input cannot alter the schema",
  );
  console.log("PASS malicious checkout URL rejection");

  console.log(`PASS seller checkout database contracts on disposable PostgreSQL ${port}`);
} finally {
  if (started) {
    try {
      runBin("pg_ctl", ["-D", pgData, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
    } catch {
      // Best-effort cleanup for a disposable local cluster.
    }
  }

  rmSync(pgData, { force: true, recursive: true });
}
