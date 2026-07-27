import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const root = process.cwd();
const pgData = mkdtempSync(path.join(tmpdir(), "ttc-booking-lifecycle-pg-"));
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

function runBinAsync(bin, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: root,
      env: pgEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${bin} exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.stdin.end(input);
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

async function sqlAsync(text) {
  return runBinAsync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], text);
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

function asUser(userId, statements) {
  return `
    set role authenticated;
    set request.jwt.claim.sub = '${userId}';
    set request.jwt.claim.role = 'authenticated';
    ${statements}
  `;
}

const users = {
  client: "00000000-0000-4000-8000-000000000101",
  artist: "00000000-0000-4000-8000-000000000102",
  otherArtist: "00000000-0000-4000-8000-000000000103",
  stranger: "00000000-0000-4000-8000-000000000104",
  moderator: "00000000-0000-4000-8000-000000000105",
};

const bookings = {
  accepted: "10000000-0000-4000-8000-000000000001",
  rescheduled: "10000000-0000-4000-8000-000000000002",
  overlap: "10000000-0000-4000-8000-000000000003",
  adjacent: "10000000-0000-4000-8000-000000000004",
  cancelled: "10000000-0000-4000-8000-000000000005",
  otherArtist: "10000000-0000-4000-8000-000000000006",
  raceOne: "10000000-0000-4000-8000-000000000007",
  raceTwo: "10000000-0000-4000-8000-000000000008",
};

try {
  runBin("initdb", ["-D", pgData, "-U", "postgres", "--auth=trust", "--no-instructions"], { stdio: "ignore" });
  runBin("pg_ctl", ["-D", pgData, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"], { stdio: "ignore" });
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

    create type public.account_type as enum ('artist', 'enthusiast', 'studio', 'supplier');
    create type public.user_role as enum ('user', 'moderator', 'admin', 'owner');

    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text not null unique,
      display_name text not null,
      account_type public.account_type not null default 'enthusiast',
      role public.user_role not null default 'user',
      shop_profile_id uuid,
      license_verified_at timestamptz,
      suspended_at timestamptz,
      banned_at timestamptz,
      is_private boolean not null default false
    );

    create table public.conversations (
      id uuid primary key default gen_random_uuid(),
      created_by uuid references public.profiles(id) on delete set null,
      created_at timestamptz not null default now()
    );

    create table public.notifications (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid references public.profiles(id) on delete set null,
      body text,
      href text,
      recipient_id uuid not null references public.profiles(id) on delete cascade,
      subject_id uuid,
      subject_type text not null,
      title text not null,
      type text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );

    alter table public.profiles enable row level security;
    alter table public.notifications enable row level security;

    create function private.current_user_can_moderate()
    returns boolean
    language sql
    security definer
    set search_path = public, private
    stable
    as $$
      select exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role in ('moderator', 'admin', 'owner')
          and profiles.suspended_at is null
          and profiles.banned_at is null
      )
    $$;

    grant usage on schema public, auth, private to anon, authenticated, service_role;
    grant select on public.profiles to authenticated, service_role;
    grant execute on function private.current_user_can_moderate() to authenticated;
  `);

  sql(migration("20260713015711_booking_request_foundation.sql"));
  sql(migration("20260713192618_booking_scheduled_calendar_fields.sql"));
  sql(`
    alter table public.booking_requests
      add column if not exists payment_dispute_hold boolean not null default false;
  `);
  sql(migration("20260727090000_booking_lifecycle_completion.sql"));
  sql(migration("20260727100000_enforce_booking_active_schedule_overlap.sql"));
  sql(`
    grant select, insert, update, delete on all tables in schema public to service_role;
    grant usage on schema public, auth, private to anon, authenticated, service_role;
  `);

  sql(`
    insert into auth.users (id, email) values
      ('${users.client}', 'client@example.invalid'),
      ('${users.artist}', 'artist@example.invalid'),
      ('${users.otherArtist}', 'other-artist@example.invalid'),
      ('${users.stranger}', 'stranger@example.invalid'),
      ('${users.moderator}', 'moderator@example.invalid');

    insert into public.profiles (id, username, display_name, account_type, role, license_verified_at)
    values
      ('${users.client}', 'phase4_client', 'Phase 4 Client', 'enthusiast', 'user', null),
      ('${users.artist}', 'phase4_artist', 'Phase 4 Artist', 'artist', 'user', now()),
      ('${users.otherArtist}', 'phase4_other_artist', 'Phase 4 Other Artist', 'artist', 'user', now()),
      ('${users.stranger}', 'phase4_stranger', 'Phase 4 Stranger', 'enthusiast', 'user', null),
      ('${users.moderator}', 'phase4_moderator', 'Phase 4 Moderator', 'enthusiast', 'moderator', null);
  `);

  assert.equal(
    scalar("select to_regclass('public.booking_status_events')::text;"),
    "booking_status_events",
    "booking status event table is created",
  );
  assert.equal(
    scalar("select count(*) from pg_constraint where conname = 'booking_requests_active_schedule_no_overlap';"),
    "1",
    "active booking schedule overlap constraint exists",
  );
  assert.equal(
    scalar("select has_table_privilege('authenticated', 'public.booking_status_events', 'select')::text;"),
    "true",
    "authenticated can reach booking event reads through RLS",
  );
  assert.equal(
    scalar("select has_function_privilege('authenticated', 'public.reserve_booking_deposit_checkout(uuid, uuid)', 'execute')::text;"),
    "false",
    "authenticated cannot execute the deposit reservation RPC",
  );
  assert.equal(
    scalar("select has_function_privilege('service_role', 'public.reserve_booking_deposit_checkout(uuid, uuid)', 'execute')::text;"),
    "true",
    "service role can execute the deposit reservation RPC",
  );
  assert.equal(
    scalar("select prosecdef::text from pg_proc where oid = 'public.reserve_booking_deposit_checkout(uuid, uuid)'::regprocedure;"),
    "false",
    "deposit reservation RPC stays security invoker",
  );
  assert.match(
    scalar("select proconfig::text from pg_proc where oid = 'public.reserve_booking_deposit_checkout(uuid, uuid)'::regprocedure;"),
    /search_path=/,
    "deposit reservation RPC has a fixed empty search_path",
  );

  sql(`
    insert into public.booking_requests (
      id, client_id, artist_id, title, body, deposit_amount_cents, platform_fee_cents,
      total_cents, status, payment_status, scheduled_start_at, scheduled_end_at, scheduled_timezone
    )
    values
      ('${bookings.accepted}', '${users.client}', '${users.artist}', 'Deposit booking', 'Large blackwork shoulder request.', 10000, 500, 10500, 'accepted', 'not_ready', '2035-01-01 10:00+00', '2035-01-01 11:00+00', 'UTC'),
      ('${bookings.rescheduled}', '${users.client}', '${users.artist}', 'Rescheduled booking', 'Fine line forearm request.', 5000, 250, 5250, 'rescheduled', 'not_ready', '2035-01-02 10:00+00', '2035-01-02 11:00+00', 'UTC');

    insert into public.booking_status_events (actor_id, booking_id, from_status, to_status, note)
    values ('${users.artist}', '${bookings.accepted}', 'requested', 'accepted', 'Accepted by artist.');
  `);

  assert.equal(
    scalar(asUser(users.client, `select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}';`)),
    "1",
    "booking client can read lifecycle events",
  );
  assert.equal(
    scalar(asUser(users.artist, `select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}';`)),
    "1",
    "booking artist can read lifecycle events",
  );
  assert.equal(
    scalar(asUser(users.stranger, `select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}';`)),
    "0",
    "unrelated user cannot read lifecycle events",
  );
  expectSqlError(
    asUser(users.client, `
      insert into public.booking_status_events (actor_id, booking_id, from_status, to_status, note)
      values ('${users.client}', '${bookings.accepted}', 'accepted', 'cancelled', 'Client tried direct insert.');
    `),
    /violates row-level security|permission denied|42501/i,
    "non-moderators cannot directly write lifecycle events",
  );
  sql(asUser(users.moderator, `
    insert into public.booking_status_events (actor_id, booking_id, from_status, to_status, note)
    values ('${users.moderator}', '${bookings.accepted}', 'accepted', 'accepted', 'Moderator audit note.');
  `));
  assert.equal(
    scalar(asUser(users.client, `select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}';`)),
    "2",
    "moderator lifecycle event insert is visible to participants",
  );

  assert.equal(
    scalar(`set role service_role; select count(*) from public.reserve_booking_deposit_checkout('${bookings.accepted}', '${users.client}');`),
    "1",
    "first deposit reservation succeeds for the server-derived client",
  );
  assert.equal(
    scalar(`select status || ':' || payment_status from public.booking_requests where id = '${bookings.accepted}';`),
    "deposit_pending:checkout_started",
    "deposit reservation atomically moves booking into checkout started state",
  );
  assert.equal(
    scalar(`select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}' and to_status = 'deposit_pending';`),
    "1",
    "deposit reservation writes one lifecycle event",
  );
  assert.equal(
    scalar(`set role service_role; select count(*) from public.reserve_booking_deposit_checkout('${bookings.accepted}', '${users.client}');`),
    "0",
    "repeated deposit reservation returns no row after state change",
  );
  assert.equal(
    scalar(`select count(*) from public.booking_status_events where booking_id = '${bookings.accepted}' and to_status = 'deposit_pending';`),
    "1",
    "repeated deposit reservation does not duplicate lifecycle events",
  );
  assert.equal(
    scalar(`set role service_role; select count(*) from public.reserve_booking_deposit_checkout('${bookings.rescheduled}', '${users.stranger}');`),
    "0",
    "deposit reservation does not trust a mismatched client id",
  );
  expectSqlError(
    asUser(users.client, `select public.reserve_booking_deposit_checkout('${bookings.rescheduled}', '${users.client}');`),
    /permission denied|42501/i,
    "authenticated clients cannot call the server-only reservation RPC directly",
  );

  expectSqlError(
    `
      insert into public.booking_requests (
        id, client_id, artist_id, title, body, deposit_amount_cents, platform_fee_cents,
        total_cents, status, payment_status, scheduled_start_at, scheduled_end_at, scheduled_timezone
      )
      values ('${bookings.overlap}', '${users.client}', '${users.artist}', 'Overlapping booking', 'Another overlapping tattoo request.', 1000, 50, 1050, 'accepted', 'not_ready', '2035-01-02 10:30+00', '2035-01-02 11:30+00', 'UTC');
    `,
    /conflicting key value violates exclusion constraint|23P01/i,
    "overlapping active bookings for the same artist cannot both exist",
  );
  sql(`
    insert into public.booking_requests (
      id, client_id, artist_id, title, body, deposit_amount_cents, platform_fee_cents,
      total_cents, status, payment_status, scheduled_start_at, scheduled_end_at, scheduled_timezone
    )
    values
      ('${bookings.adjacent}', '${users.client}', '${users.artist}', 'Adjacent booking', 'Adjacent appointment request.', 1000, 50, 1050, 'accepted', 'not_ready', '2035-01-02 11:00+00', '2035-01-02 12:00+00', 'UTC'),
      ('${bookings.cancelled}', '${users.client}', '${users.artist}', 'Cancelled overlap', 'Cancelled overlapping request.', 1000, 50, 1050, 'cancelled', 'not_ready', '2035-01-02 10:30+00', '2035-01-02 11:30+00', 'UTC'),
      ('${bookings.otherArtist}', '${users.client}', '${users.otherArtist}', 'Other artist overlap', 'Different artist overlapping request.', 1000, 50, 1050, 'accepted', 'not_ready', '2035-01-02 10:30+00', '2035-01-02 11:30+00', 'UTC');
  `);
  assert.equal(
    scalar(`select count(*) from public.booking_requests where id in ('${bookings.adjacent}', '${bookings.cancelled}', '${bookings.otherArtist}');`),
    "3",
    "adjacent windows, inactive overlaps, and other artists remain valid",
  );

  const raceInsert = (id) => sqlAsync(`
    insert into public.booking_requests (
      id, client_id, artist_id, title, body, deposit_amount_cents, platform_fee_cents,
      total_cents, status, payment_status, scheduled_start_at, scheduled_end_at, scheduled_timezone
    )
    values ('${id}', '${users.client}', '${users.artist}', 'Race booking ${id.slice(-1)}', 'Concurrent appointment request.', 1000, 50, 1050, 'accepted', 'not_ready', '2035-01-03 10:00+00', '2035-01-03 11:00+00', 'UTC');
  `);
  const raceResults = await Promise.allSettled([raceInsert(bookings.raceOne), raceInsert(bookings.raceTwo)]);
  assert.equal(
    raceResults.filter((result) => result.status === "fulfilled").length,
    1,
    "concurrent active inserts for one artist/time allow only one winner",
  );
  assert.equal(
    scalar(`select count(*) from public.booking_requests where id in ('${bookings.raceOne}', '${bookings.raceTwo}');`),
    "1",
    "concurrent active inserts persist exactly one booking",
  );

  console.log(`PASS booking lifecycle database contracts on disposable PostgreSQL ${port}`);
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
