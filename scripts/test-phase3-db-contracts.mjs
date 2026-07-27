import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const root = process.cwd();
const pgData = mkdtempSync(path.join(tmpdir(), "ttc-phase3-pg-"));
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

function asUser(userId, statements) {
  return `
    set role authenticated;
    set request.jwt.claim.sub = '${userId}';
    set request.jwt.claim.role = 'authenticated';
    ${statements}
  `;
}

const users = {
  alice: "00000000-0000-4000-8000-000000000001",
  bob: "00000000-0000-4000-8000-000000000002",
  carol: "00000000-0000-4000-8000-000000000003",
  banned: "00000000-0000-4000-8000-000000000004",
  suspended: "00000000-0000-4000-8000-000000000005",
  internal: "00000000-0000-4000-8000-000000000006",
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

    create function auth.role()
    returns text
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
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
      suspended_at timestamptz,
      banned_at timestamptz,
      notify_message_activity boolean,
      notify_push_enabled boolean,
      notification_quiet_hours_enabled boolean,
      notification_quiet_hours_start time,
      notification_quiet_hours_end time,
      notification_timezone text
    );

    create table public.conversations (
      id uuid primary key default gen_random_uuid(),
      created_by uuid references public.profiles(id) on delete set null,
      created_at timestamptz not null default now()
    );

    create table public.conversation_members (
      conversation_id uuid not null references public.conversations(id) on delete cascade,
      user_id uuid not null references public.profiles(id) on delete cascade,
      last_read_at timestamptz,
      created_at timestamptz not null default now(),
      primary key (conversation_id, user_id)
    );

    create table public.messages (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references public.conversations(id) on delete cascade,
      sender_id uuid not null references public.profiles(id) on delete cascade,
      body text not null check (char_length(body) between 1 and 4000),
      created_at timestamptz not null default now()
    );

    create table public.user_blocks (
      blocker_id uuid not null references public.profiles(id) on delete cascade,
      blocked_id uuid not null references public.profiles(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (blocker_id, blocked_id),
      check (blocker_id <> blocked_id)
    );

    create table public.notifications (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid references public.profiles(id) on delete set null,
      body text,
      href text,
      message_id uuid references public.messages(id) on delete cascade,
      recipient_id uuid not null references public.profiles(id) on delete cascade,
      subject_id uuid,
      subject_type text not null,
      title text not null,
      type text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table public.native_push_devices (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid not null references public.profiles(id) on delete cascade,
      token text not null,
      token_hash text not null unique,
      platform text not null,
      installation_id text not null,
      is_active boolean not null default true,
      last_seen_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (platform, installation_id)
    );

    create table public.native_push_delivery_jobs (
      id uuid primary key default gen_random_uuid(),
      notification_id uuid not null references public.notifications(id) on delete cascade,
      device_id uuid not null references public.native_push_devices(id) on delete cascade,
      status text not null default 'pending',
      unique (notification_id, device_id)
    );

    alter table public.profiles enable row level security;
    alter table public.conversations enable row level security;
    alter table public.conversation_members enable row level security;
    alter table public.messages enable row level security;
    alter table public.user_blocks enable row level security;
    alter table public.notifications enable row level security;
    alter table public.native_push_devices enable row level security;

    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.profiles to authenticated, service_role;
    grant select, insert on public.conversations to authenticated;
    grant select, insert on public.conversation_members to authenticated;
    grant select, insert on public.messages to authenticated;
    grant select, insert, delete on public.user_blocks to authenticated;
    grant select, update, delete on public.notifications to authenticated;
    grant select, insert, update, delete on public.notifications to service_role;
    grant select, insert, update, delete on public.native_push_devices to service_role;
    grant select, insert, update, delete on public.native_push_delivery_jobs to service_role;

    create function private.current_user_is_conversation_member(target_conversation_id uuid)
    returns boolean
    language sql
    security definer
    set search_path = public, private
    stable
    as $$
      select exists (
        select 1
        from public.conversation_members
        where conversation_members.conversation_id = target_conversation_id
          and conversation_members.user_id = (select auth.uid())
      )
    $$;

    create function private.current_user_created_conversation(target_conversation_id uuid)
    returns boolean
    language sql
    security definer
    set search_path = public, private
    stable
    as $$
      select exists (
        select 1
        from public.conversations
        where conversations.id = target_conversation_id
          and conversations.created_by = (select auth.uid())
      )
    $$;

    grant execute on function private.current_user_is_conversation_member(uuid) to authenticated;
    grant execute on function private.current_user_created_conversation(uuid) to authenticated;

    create policy "Members can view conversations"
      on public.conversations for select
      to authenticated
      using (
        private.current_user_is_conversation_member(id)
        or created_by = (select auth.uid())
      );

    create policy "Authenticated users can create conversations"
      on public.conversations for insert
      to authenticated
      with check (created_by = (select auth.uid()));

    create policy "Members can view members"
      on public.conversation_members for select
      to authenticated
      using (
        private.current_user_is_conversation_member(conversation_id)
        or private.current_user_created_conversation(conversation_id)
      );

    create policy "Users can add conversation members"
      on public.conversation_members for insert
      to authenticated
      with check (
        user_id = (select auth.uid())
        or private.current_user_created_conversation(conversation_id)
      );

    create policy "Members can read messages"
      on public.messages for select
      to authenticated
      using (private.current_user_is_conversation_member(conversation_id));

    create policy "Members can send messages"
      on public.messages for insert
      to authenticated
      with check (
        sender_id = (select auth.uid())
        and private.current_user_is_conversation_member(conversation_id)
      );

    create policy "Users can view own blocks"
      on public.user_blocks for select
      to authenticated
      using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));

    create policy "Users can block"
      on public.user_blocks for insert
      to authenticated
      with check (blocker_id = (select auth.uid()));

    create policy "Users can read own notifications"
      on public.notifications for select
      to authenticated
      using (recipient_id = (select auth.uid()));

    create policy "Users can update own notifications"
      on public.notifications for update
      to authenticated
      using (recipient_id = (select auth.uid()))
      with check (recipient_id = (select auth.uid()));

    create policy "Users can delete own notifications"
      on public.notifications for delete
      to authenticated
      using (recipient_id = (select auth.uid()));
  `);

  sql(`
    insert into auth.users (id, email) values
      ('${users.alice}', 'alice@example.invalid'),
      ('${users.bob}', 'bob@example.invalid'),
      ('${users.carol}', 'carol@example.invalid'),
      ('${users.banned}', 'banned@example.invalid'),
      ('${users.suspended}', 'suspended@example.invalid'),
      ('${users.internal}', 'internal@example.invalid');

    insert into public.profiles (id, username, display_name, banned_at, suspended_at, notify_message_activity, notify_push_enabled)
    values
      ('${users.alice}', 'alice_phase3', 'Alice', null, null, true, true),
      ('${users.bob}', 'bob_phase3', 'Bob', null, null, true, true),
      ('${users.carol}', 'carol_phase3', 'Carol', null, null, true, true),
      ('${users.banned}', 'banned_phase3', 'Banned', now(), null, true, true),
      ('${users.suspended}', 'suspended_phase3', 'Suspended', null, now(), true, true),
      ('${users.internal}', 'ttc_reviewer', 'Reviewer', null, null, true, true);
  `);

  sql(migration("20260726183000_direct_conversation_pairs.sql"));
  sql(migration("20260726194500_harden_direct_conversation_availability.sql"));
  sql(migration("20260726200000_dedupe_message_notifications.sql"));
  sql(migration("20260726201000_conversation_member_read_state_policy.sql"));
  sql(migration("20260726202000_direct_pair_member_select_grant.sql"));

  assert.equal(
    scalar("select pg_get_userbyid(relowner) from pg_class where oid = 'public.direct_conversation_pairs'::regclass;"),
    "postgres",
    "direct pair table is owned by the migration owner",
  );
  assert.equal(
    scalar("select prosecdef::text from pg_proc where oid = 'public.ensure_direct_conversation(uuid)'::regprocedure;"),
    "true",
    "direct conversation RPC is security definer",
  );
  assert.match(
    scalar("select proconfig::text from pg_proc where oid = 'public.ensure_direct_conversation(uuid)'::regprocedure;"),
    /search_path=public, private/,
    "direct conversation RPC has a fixed search_path",
  );
  assert.equal(
    scalar("select has_function_privilege('anon', 'public.ensure_direct_conversation(uuid)', 'execute')::text;"),
    "false",
    "anon cannot execute direct conversation RPC",
  );
  assert.equal(
    scalar("select has_function_privilege('authenticated', 'public.ensure_direct_conversation(uuid)', 'execute')::text;"),
    "true",
    "authenticated can execute direct conversation RPC",
  );
  assert.equal(
    scalar("select has_table_privilege('authenticated', 'public.direct_conversation_pairs', 'insert')::text;"),
    "false",
    "authenticated cannot write direct pair rows",
  );

  expectSqlError(
    `set role anon; select public.ensure_direct_conversation('${users.bob}');`,
    /permission denied|42501/i,
    "anon RPC execution is denied",
  );
  expectSqlError(
    asUser("", `select public.ensure_direct_conversation('${users.bob}');`),
    /invalid input syntax|Authentication required/i,
    "unauthenticated RPC execution is denied",
  );

  const aliceBob = scalar(asUser(users.alice, `select public.ensure_direct_conversation('${users.bob}');`));
  assert.match(aliceBob, /^[0-9a-f-]{36}$/i, "authenticated participant can create a direct conversation");
  assert.equal(
    scalar(asUser(users.bob, `select public.ensure_direct_conversation('${users.alice}');`)),
    aliceBob,
    "reversed participant order returns the same direct conversation",
  );
  assert.equal(
    scalar(asUser(users.alice, `select public.ensure_direct_conversation('${users.bob}');`)),
    aliceBob,
    "repeated calls return the same direct conversation",
  );
  assert.equal(
    scalar(asUser(users.alice, `select count(*) from public.direct_conversation_pairs where conversation_id = '${aliceBob}';`)),
    "1",
    "one direct pair row exists for the conversation",
  );
  assert.equal(
    scalar(asUser(users.carol, `select count(*) from public.direct_conversation_pairs where conversation_id = '${aliceBob}';`)),
    "0",
    "unrelated users cannot read direct pair rows",
  );
  assert.equal(
    scalar(asUser(users.carol, `select count(*) from public.conversations where id = '${aliceBob}';`)),
    "0",
    "unrelated users cannot read conversations",
  );

  expectSqlError(
    asUser(users.alice, `select public.ensure_direct_conversation('${users.banned}');`),
    /Conversation target unavailable/i,
    "banned targets are unavailable",
  );
  expectSqlError(
    asUser(users.alice, `select public.ensure_direct_conversation('${users.suspended}');`),
    /Conversation target unavailable/i,
    "suspended targets are unavailable",
  );
  expectSqlError(
    asUser(users.alice, `select public.ensure_direct_conversation('${users.internal}');`),
    /Conversation target unavailable/i,
    "internal reviewer/test targets are unavailable",
  );
  expectSqlError(
    asUser(users.banned, `select public.ensure_direct_conversation('${users.alice}');`),
    /Authentication required/i,
    "banned callers cannot create direct conversations",
  );

  sql(`insert into public.user_blocks (blocker_id, blocked_id) values ('${users.alice}', '${users.carol}');`);
  expectSqlError(
    asUser(users.alice, `select public.ensure_direct_conversation('${users.carol}');`),
    /Conversation target unavailable/i,
    "caller-to-target block denies direct conversation",
  );
  sql(`delete from public.user_blocks where blocker_id = '${users.alice}' and blocked_id = '${users.carol}';`);
  sql(`insert into public.user_blocks (blocker_id, blocked_id) values ('${users.carol}', '${users.alice}');`);
  expectSqlError(
    asUser(users.alice, `select public.ensure_direct_conversation('${users.carol}');`),
    /Conversation target unavailable/i,
    "target-to-caller block denies direct conversation",
  );
  sql(`delete from public.user_blocks where blocker_id = '${users.carol}' and blocked_id = '${users.alice}';`);

  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      Promise.resolve(
        scalar(asUser(users.bob, `select public.ensure_direct_conversation('${users.carol}');`)),
      ),
    ),
  );
  assert.equal(new Set(concurrent).size, 1, "concurrent calls return one conversation");
  assert.equal(
    scalar(`select count(*) from public.direct_conversation_pairs where conversation_id = '${concurrent[0]}';`),
    "1",
    "concurrent calls create exactly one direct pair",
  );

  const messageId = scalar(asUser(users.alice, `
    insert into public.messages (conversation_id, sender_id, body)
    values ('${aliceBob}', '${users.alice}', '<script>alert("safe render")</script>')
    returning id;
  `));
  assert.match(messageId, /^[0-9a-f-]{36}$/i, "authenticated participant can send a message");
  expectSqlError(
    asUser(users.alice, `
      insert into public.messages (conversation_id, sender_id, body)
      values ('${aliceBob}', '${users.bob}', 'impersonated');
    `),
    /violates row-level security|permission denied|42501/i,
    "caller cannot send as another user",
  );
  expectSqlError(
    asUser(users.carol, `
      insert into public.messages (conversation_id, sender_id, body)
      values ('${aliceBob}', '${users.carol}', 'intrusion');
    `),
    /violates row-level security|permission denied|42501/i,
    "unrelated users cannot send into a conversation",
  );
  assert.equal(
    scalar(asUser(users.carol, `select count(*) from public.messages where conversation_id = '${aliceBob}';`)),
    "0",
    "unrelated users cannot read message rows",
  );

  const duplicateMessageCount = scalar(asUser(users.alice, `
    insert into public.messages (conversation_id, sender_id, body)
    values ('${aliceBob}', '${users.alice}', 'duplicate-click sample');
    insert into public.messages (conversation_id, sender_id, body)
    values ('${aliceBob}', '${users.alice}', 'duplicate-click sample');
    select count(*) from public.messages
    where conversation_id = '${aliceBob}'
      and sender_id = '${users.alice}'
      and body = 'duplicate-click sample';
  `));
  assert.equal(duplicateMessageCount, "2", "duplicate message submissions are accepted as distinct sends");

  assert.equal(
    scalar(asUser(users.bob, `
      select count(*) from public.messages
      where conversation_id = '${aliceBob}'
        and sender_id <> '${users.bob}'
        and created_at > coalesce(
          (select last_read_at from public.conversation_members where conversation_id = '${aliceBob}' and user_id = '${users.bob}'),
          '-infinity'::timestamptz
        );
    `)),
    "3",
    "recipient unread count includes incoming unread messages",
  );
  assert.equal(
    scalar(asUser(users.alice, `
      select count(*) from public.messages
      where conversation_id = '${aliceBob}'
        and sender_id <> '${users.alice}'
        and created_at > coalesce(
          (select last_read_at from public.conversation_members where conversation_id = '${aliceBob}' and user_id = '${users.alice}'),
          '-infinity'::timestamptz
        );
    `)),
    "0",
    "sender does not receive unread count for own messages",
  );
  sql(asUser(users.bob, `
    update public.conversation_members
    set last_read_at = now()
    where conversation_id = '${aliceBob}' and user_id = '${users.bob}';
  `));
  assert.equal(
    scalar(`select count(*) from public.conversation_members where conversation_id = '${aliceBob}' and user_id = '${users.bob}' and last_read_at is not null;`),
    "1",
    "mark-read updates the current participant",
  );
  expectSqlError(
    asUser(users.bob, `
      update public.conversation_members
      set user_id = '${users.alice}'
      where conversation_id = '${aliceBob}' and user_id = '${users.bob}';
    `),
    /permission denied|42501/i,
    "mark-read grant cannot rewrite membership identity",
  );

  sql(`set role service_role;
    select public.insert_notifications_with_native_delivery(
      jsonb_build_array(jsonb_build_object(
        'actor_id', '${users.alice}',
        'body', 'approved minimal preview',
        'href', '/messages?c=${aliceBob}',
        'message_id', '${messageId}',
        'recipient_id', '${users.bob}',
        'subject_id', '${aliceBob}',
        'subject_type', 'conversation',
        'title', 'New message from Alice',
        'type', 'message'
      )),
      false
    );
    select public.insert_notifications_with_native_delivery(
      jsonb_build_array(jsonb_build_object(
        'actor_id', '${users.alice}',
        'body', 'approved minimal preview',
        'href', '/messages?c=${aliceBob}',
        'message_id', '${messageId}',
        'recipient_id', '${users.bob}',
        'subject_id', '${aliceBob}',
        'subject_type', 'conversation',
        'title', 'New message from Alice',
        'type', 'message'
      )),
      false
    );
  `);
  assert.equal(
    scalar(asUser(users.bob, `select count(*) from public.notifications where message_id = '${messageId}';`)),
    "1",
    "message notification retries are deduped",
  );
  assert.equal(
    scalar(asUser(users.alice, `select count(*) from public.notifications where message_id = '${messageId}';`)),
    "0",
    "another user cannot read the recipient notification",
  );
  assert.equal(
    scalar(asUser(users.bob, `select count(*) from public.notifications where read_at is null;`)),
    "1",
    "notification unread count is accurate",
  );
  sql(asUser(users.alice, `
    update public.notifications
    set read_at = now()
    where message_id = '${messageId}';
  `));
  assert.equal(
    scalar(asUser(users.bob, `select count(*) from public.notifications where read_at is null;`)),
    "1",
    "mark-one-read by another user is denied by RLS",
  );
  sql(asUser(users.bob, `
    update public.notifications
    set read_at = now()
    where message_id = '${messageId}' and recipient_id = '${users.bob}';
  `));
  assert.equal(
    scalar(asUser(users.bob, `select count(*) from public.notifications where read_at is null;`)),
    "0",
    "mark-one-read affects the current user's notification",
  );
  sql(`set role service_role;
    insert into public.notifications (actor_id, body, href, recipient_id, subject_id, subject_type, title, type)
    values
      ('${users.alice}', 'one', '/messages?c=${aliceBob}', '${users.bob}', '${aliceBob}', 'conversation', 'Unread one', 'message'),
      ('${users.alice}', 'two', '/messages?c=${aliceBob}', '${users.bob}', '${aliceBob}', 'conversation', 'Unread two', 'message'),
      ('${users.bob}', 'other', '/messages?c=${aliceBob}', '${users.alice}', '${aliceBob}', 'conversation', 'Other user unread', 'message');
  `);
  sql(asUser(users.bob, `
    update public.notifications
    set read_at = now()
    where recipient_id = '${users.bob}' and read_at is null;
  `));
  assert.equal(
    scalar(asUser(users.bob, `select count(*) from public.notifications where read_at is null;`)),
    "0",
    "mark-all-read clears only the current user's unread notifications",
  );
  assert.equal(
    scalar(asUser(users.alice, `select count(*) from public.notifications where read_at is null;`)),
    "1",
    "mark-all-read does not affect another user's unread notifications",
  );
  assert.equal(
    scalar("select has_function_privilege('authenticated', 'public.insert_notifications_with_native_delivery(jsonb, boolean)', 'execute')::text;"),
    "false",
    "authenticated users cannot execute notification writer RPC",
  );
  assert.equal(
    scalar("select has_function_privilege('service_role', 'public.insert_notifications_with_native_delivery(jsonb, boolean)', 'execute')::text;"),
    "true",
    "service_role can execute notification writer RPC",
  );

  assert.equal(
    scalar("select has_table_privilege('authenticated', 'public.native_push_devices', 'insert')::text;"),
    "false",
    "native push devices remain service-only at the table layer",
  );
  sql(`set role service_role;
    insert into public.native_push_devices (profile_id, token, token_hash, platform, installation_id)
    values ('${users.bob}', 'device-token-value', 'hash-one', 'android', 'install-one')
    on conflict (platform, installation_id) do update
    set profile_id = excluded.profile_id,
        token = excluded.token,
        token_hash = excluded.token_hash,
        updated_at = now();
  `);
  assert.equal(
    scalar("select count(*) from public.native_push_devices where token_hash = 'hash-one';"),
    "1",
    "duplicate native registration is handled by the unique installation identity",
  );

  sql("drop function if exists public.ensure_direct_conversation(uuid); drop table if exists public.direct_conversation_pairs;");
  assert.equal(
    scalar("select to_regclass('public.direct_conversation_pairs') is null and to_regprocedure('public.ensure_direct_conversation(uuid)') is null;"),
    "t",
    "rollback instructions are syntactically valid in the disposable database",
  );

  console.log(`PASS phase3 database contracts on disposable PostgreSQL ${port}`);
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
