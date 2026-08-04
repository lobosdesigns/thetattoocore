import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260803160000_ad_credit_purchase_sources.sql",
);
const migrationSource = readFileSync(migrationPath, "utf8");

function loadTypeScriptModule(filePath, cache = new Map()) {
  const absolutePath = path.resolve(root, filePath);
  if (cache.has(absolutePath)) return cache.get(absolutePath).exports;

  const source = readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `TypeScript transpilation failed for ${filePath}`);

  const loadedModule = { exports: {} };
  cache.set(absolutePath, loadedModule);
  const localRequire = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier.startsWith("node:")) return nativeRequire(specifier);
    if (
      specifier === "@apple/app-store-server-library" ||
      specifier === "google-auth-library"
    ) {
      return nativeRequire(specifier);
    }
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(absolutePath), specifier);
      return loadTypeScriptModule(
        path.extname(resolved) ? resolved : `${resolved}.ts`,
        cache,
      );
    }
    throw new Error(`Unexpected test module dependency: ${specifier}`);
  };
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${output.outputText}\n})`,
    { filename: absolutePath },
  );
  wrapper(
    loadedModule.exports,
    localRequire,
    loadedModule,
    absolutePath,
    path.dirname(absolutePath),
  );
  return loadedModule.exports;
}

const packagesModule = loadTypeScriptModule("src/lib/ads/credit-packages.ts");
const grantModule = loadTypeScriptModule("src/lib/ads/purchase-grant.ts");
const profileId = "00000000-0000-4000-8000-000000000901";
const otherProfileId = "00000000-0000-4000-8000-000000000902";
const holdSpendProfileId = "00000000-0000-4000-8000-000000000910";
const partialRefundProfileId = "00000000-0000-4000-8000-000000000911";
const fullySpentProfileId = "00000000-0000-4000-8000-000000000912";
const appleReversalProfileId = "00000000-0000-4000-8000-000000000913";
const googleTombstoneProfileId = "00000000-0000-4000-8000-000000000914";
const concurrentProfileId = "00000000-0000-4000-8000-000000000915";
const ledgerId = "10000000-0000-4000-8000-000000000901";

assert.deepEqual(packagesModule.adCreditPackages, {
  "ttc.adcredit.2500": { creditCents: 2500, webPriceCents: 2500 },
  "ttc.adcredit.5000": { creditCents: 5000, webPriceCents: 5000 },
  "ttc.adcredit.10000": { creditCents: 10000, webPriceCents: 10000 },
});
for (const productId of Object.keys(packagesModule.adCreditPackages)) {
  assert.equal(packagesModule.isAdCreditProductId(productId), true);
  assert.equal(
    packagesModule.adCreditPackageForProductId(productId)?.creditCents,
    packagesModule.adCreditPackages[productId].creditCents,
  );
}
for (const productId of [
  "ttc.adcredit.2501",
  "ttc.adcredit.2500 ",
  "TTC.ADCREDIT.2500",
  "price_2500",
  "'; drop table public.ad_credit_ledger; --",
]) {
  assert.equal(packagesModule.isAdCreditProductId(productId), false);
  assert.equal(packagesModule.adCreditPackageForProductId(productId), null);
}
console.log("PASS ad credit packages are a fixed server-owned allowlist");

const rpcCalls = [];
const grantClient = {
  async rpc(name, args) {
    rpcCalls.push({ args, name });
    return {
      data: [{ ledger_id: ledgerId, outcome: "granted" }],
      error: null,
    };
  },
};
const verifiedPurchase = {
  creditCents: 2500,
  origin: "apple_iap",
  productId: "ttc.adcredit.2500",
  profileId,
  providerTransactionId: "2000000000000001",
};
assert.deepEqual(
  await grantModule.grantVerifiedAdCreditPurchase(grantClient, verifiedPurchase),
  { grantId: ledgerId, ok: true, outcome: "granted" },
);
assert.deepEqual(rpcCalls, [
  {
    name: "grant_verified_ad_credit_purchase",
    args: {
      p_credit_cents: 2500,
      p_credit_origin: "apple_iap",
      p_product_id: "ttc.adcredit.2500",
      p_profile_id: profileId,
      p_provider_currency: null,
      p_provider_paid_amount_cents: null,
      p_provider_transaction_id: "2000000000000001",
    },
  },
]);

for (const forgedPurchase of [
  { ...verifiedPurchase, creditCents: 999999 },
  { ...verifiedPurchase, origin: "promo" },
  { ...verifiedPurchase, productId: "ttc.adcredit.999999" },
  { ...verifiedPurchase, profileId: otherProfileId.replace("9", "z") },
  { ...verifiedPurchase, providerTransactionId: "tx'; select pg_sleep(10); --" },
]) {
  assert.deepEqual(
    await grantModule.grantVerifiedAdCreditPurchase(grantClient, forgedPurchase),
    { ok: false, reason: "invalid_purchase" },
  );
}
assert.equal(rpcCalls.length, 1, "invalid purchases stop before database RPCs");

const duplicateClient = {
  async rpc() {
    return {
      data: [{ ledger_id: ledgerId, outcome: "duplicate" }],
      error: null,
    };
  },
};
assert.deepEqual(
  await grantModule.grantVerifiedAdCreditPurchase(duplicateClient, verifiedPurchase),
  { grantId: ledgerId, ok: true, outcome: "duplicate" },
);

const stripePurchase = {
  ...verifiedPurchase,
  origin: "stripe_web",
  providerCurrency: "usd",
  providerPaidAmountCents: 2500,
  providerTransactionId: "pi_1234567890abcdef",
};
assert.equal(
  (await grantModule.grantVerifiedAdCreditPurchase(grantClient, stripePurchase)).ok,
  true,
);
for (const invalidStripeSettlement of [
  { ...stripePurchase, providerCurrency: "USD" },
  { ...stripePurchase, providerPaidAmountCents: 2499 },
  { ...stripePurchase, providerPaidAmountCents: 2501 },
  { ...stripePurchase, providerCurrency: undefined },
]) {
  assert.deepEqual(
    await grantModule.grantVerifiedAdCreditPurchase(
      grantClient,
      invalidStripeSettlement,
    ),
    { ok: false, reason: "invalid_purchase" },
  );
}

const confirmClient = {
  async rpc(name, args) {
    assert.equal(name, "confirm_verified_ad_credit_purchase");
    assert.deepEqual(args, {
      p_credit_origin: "apple_iap",
      p_grant_id: ledgerId,
      p_product_id: "ttc.adcredit.2500",
      p_profile_id: profileId,
      p_provider_transaction_id: "2000000000000001",
    });
    return {
      data: [{ grant_id: ledgerId }],
      error: null,
    };
  },
};
assert.deepEqual(
  await grantModule.confirmVerifiedAdCreditPurchase(confirmClient, {
    ...verifiedPurchase,
    grantId: ledgerId,
  }),
  { grantId: ledgerId, ok: true },
);
for (const forgedConfirmation of [
  { ...verifiedPurchase, grantId: "not-a-uuid" },
  { ...verifiedPurchase, creditCents: 5000, grantId: ledgerId },
  { ...verifiedPurchase, grantId: ledgerId, origin: "google_play" },
]) {
  assert.deepEqual(
    await grantModule.confirmVerifiedAdCreditPurchase(
      confirmClient,
      forgedConfirmation,
    ),
    { ok: false, reason: "invalid_confirmation" },
  );
}

const reconciliationCalls = [];
const reconciliationClient = {
  async rpc(name, args) {
    reconciliationCalls.push({ args, name });
    const outcomes = {
      hold: "held",
      release: "released",
      refund_reverse: "refund_reversed",
      terminal_void: "terminal_voided",
    };
    return {
      data: [{
        ledger_id: ledgerId,
        outcome: outcomes[args.p_action],
        purchase_state: args.p_action === "terminal_void" ? "terminal_void" : "available",
        source_id: "10000000-0000-4000-8000-000000000902",
      }],
      error: null,
    };
  },
};
const stripeReconciliation = {
  action: "hold",
  fullPurchase: false,
  origin: "stripe_web",
  productId: "ttc.adcredit.2500",
  profileId,
  providerAmountCents: 1000,
  providerCurrency: "usd",
  providerEventId: "evt_1234567890abcdef",
  providerLifecycleId: "dp_1234567890abcdef",
  providerPaidAmountCents: 2500,
  providerTransactionId: "pi_1234567890abcdef",
  purchaseCreditCents: 2500,
  reason: "dispute",
  reconciliationCreditCents: 1000,
};
for (const [action, outcome] of [
  ["hold", "held"],
  ["release", "released"],
  ["terminal_void", "terminal_voided"],
]) {
  const input = {
    ...stripeReconciliation,
    action,
    reason: action === "terminal_void" ? "refund" : "dispute",
  };
  assert.deepEqual(
    await grantModule.reconcileVerifiedAdCreditPurchase(
      reconciliationClient,
      input,
    ),
    {
      grantId: ledgerId,
      ok: true,
      outcome,
      purchaseState: action === "terminal_void" ? "terminal_void" : "available",
      sourceId: "10000000-0000-4000-8000-000000000902",
    },
  );
}

assert.deepEqual(
  await grantModule.reconcileVerifiedAdCreditPurchase(reconciliationClient, {
    action: "refund_reverse",
    fullPurchase: true,
    origin: "apple_iap",
    productId: "ttc.adcredit.2500",
    profileId,
    providerAmountCents: null,
    providerCurrency: null,
    providerEventId: "apple:00000000-0000-4000-8000-000000000903",
    providerLifecycleId: "apple-refund:2000000000000001",
    providerPaidAmountCents: null,
    providerTransactionId: "2000000000000001",
    purchaseCreditCents: 2500,
    reason: "refund",
    reconciliationCreditCents: 2500,
  }),
  {
    grantId: ledgerId,
    ok: true,
    outcome: "refund_reversed",
    purchaseState: "available",
    sourceId: "10000000-0000-4000-8000-000000000902",
  },
);

for (const invalidReconciliation of [
  { ...stripeReconciliation, action: "void" },
  { ...stripeReconciliation, action: "reinstate" },
  { ...stripeReconciliation, action: "refund_reverse" },
  { ...stripeReconciliation, providerCurrency: "USD" },
  { ...stripeReconciliation, providerAmountCents: 2501 },
  { ...stripeReconciliation, reconciliationCreditCents: 2501 },
  { ...stripeReconciliation, providerLifecycleId: "not.is.null" },
  { ...stripeReconciliation, reason: "forged" },
]) {
  assert.deepEqual(
    await grantModule.reconcileVerifiedAdCreditPurchase(
      reconciliationClient,
      invalidReconciliation,
    ),
    { ok: false, reason: "invalid_reconciliation" },
  );
}
assert.equal(
  reconciliationCalls.length,
  4,
  "legacy and malicious reconciliation actions stop before the database RPC",
);
console.log("PASS purchase grant helper rejects forged values and accepts idempotent replay");

assert.match(migrationSource, /add column if not exists credit_origin text/i);
assert.match(migrationSource, /add column if not exists provider_transaction_id text/i);
assert.match(migrationSource, /add column if not exists provider_product_id text/i);
assert.match(migrationSource, /add column if not exists refundable_cents integer/i);
assert.match(
  migrationSource,
  /add column if not exists campaign_spent_cents integer/i,
);
assert.match(
  migrationSource,
  /add column if not exists purchase_reconciliation_state text/i,
);
assert.match(
  migrationSource,
  /action in \('hold', 'release', 'terminal_void', 'refund_reverse'\)/i,
);
assert.match(
  migrationSource,
  /unique \(credit_origin, provider_event_id\)/i,
);
assert.match(
  migrationSource,
  /unique \(credit_origin, provider_transaction_id\)/i,
);
assert.match(migrationSource, /create table public\.ad_credit_purchase_sources/i);
assert.match(migrationSource, /create table public\.ad_credit_purchase_lifecycles/i);
assert.match(migrationSource, /create table public\.ad_credit_purchase_events/i);
assert.match(migrationSource, /create table public\.ad_credit_campaign_allocations/i);
assert.match(migrationSource, /provider_lifecycle_id/i);
assert.match(migrationSource, /provider_paid_amount_cents/i);
assert.match(migrationSource, /provider_event_amount_cents/i);
assert.match(migrationSource, /spent_terminal_loss_cents/i);
assert.match(migrationSource, /ad_credit_purchase_debt_cents/i);
assert.match(migrationSource, /create or replace function public\.grant_verified_ad_credit_purchase/i);
assert.match(migrationSource, /create or replace function public\.confirm_verified_ad_credit_purchase/i);
assert.match(migrationSource, /create or replace function public\.reconcile_verified_ad_credit_purchase/i);
assert.match(migrationSource, /create or replace function public\.resolve_google_ad_purchase_profile/i);
assert.match(migrationSource, /set search_path = ''/i);
assert.match(migrationSource, /revoke (insert|insert, update|update, insert)[^;]*authenticated/i);
assert.equal(/^\s*execute\s+(?!on\b)/im.test(migrationSource), false);
console.log("PASS migration source declares the durable server-only purchase boundary");

const pgData = mkdtempSync(path.join(tmpdir(), "ttc-ad-credit-pg-"));
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

function sql(text) {
  return runBin("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], { input: text });
}

function scalar(text) {
  return runBin("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
    input: text,
  }).trim();
}

function sqlAsync(text) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], {
      cwd: root,
      env: pgEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
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
      if (code === 0) resolve(stdout);
      else reject(new Error(`psql exited ${code}: ${stderr}`));
    });
    child.stdin.end(text);
  });
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

function asRole(role, statements, userId = null) {
  const claims = userId
    ? `set request.jwt.claim.sub = '${userId}'; set request.jwt.claim.role = 'authenticated';`
    : "";
  return `set role ${role}; ${claims} ${statements}`;
}

function sqlValue(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function grantPurchaseSql(overrides = {}) {
  const input = {
    creditCents: 2500,
    origin: "stripe_web",
    productId: "ttc.adcredit.2500",
    profileId,
    providerCurrency: "usd",
    providerPaidAmountCents: 2500,
    providerTransactionId: "pi_defaultpurchase123",
    ...overrides,
  };
  return `select outcome || ':' || ledger_id::text
    from public.grant_verified_ad_credit_purchase(
      ${sqlValue(input.origin)}, ${sqlValue(input.productId)},
      ${sqlValue(input.providerTransactionId)}, ${sqlValue(input.profileId)},
      ${sqlValue(input.creditCents)}, ${sqlValue(input.providerPaidAmountCents)},
      ${sqlValue(input.providerCurrency)}
    )`;
}

function reconcilePurchaseSql(overrides = {}, projection = "outcome") {
  const input = {
    action: "hold",
    fullPurchase: false,
    origin: "stripe_web",
    productId: "ttc.adcredit.2500",
    profileId,
    providerEventAmountCents: 2500,
    providerCurrency: "usd",
    providerEventId: "evt_defaultpurchase123",
    providerLifecycleId: "dp_defaultpurchase123",
    providerPaidAmountCents: 2500,
    providerTransactionId: "pi_defaultpurchase123",
    purchaseCreditCents: 2500,
    reason: "dispute",
    reconciliationCreditCents: 2500,
    ...overrides,
  };
  return `select ${projection}
    from public.reconcile_verified_ad_credit_purchase(
      ${sqlValue(input.origin)}, ${sqlValue(input.providerTransactionId)},
      ${sqlValue(input.providerLifecycleId)}, ${sqlValue(input.providerEventId)},
      ${sqlValue(input.action)}, ${sqlValue(input.reason)},
      ${sqlValue(input.productId)}, ${sqlValue(input.profileId)},
      ${sqlValue(input.purchaseCreditCents)},
      ${sqlValue(input.reconciliationCreditCents)},
      ${sqlValue(input.fullPurchase)},
      ${sqlValue(input.providerPaidAmountCents)},
      ${sqlValue(input.providerEventAmountCents)},
      ${sqlValue(input.providerCurrency)}
    )`;
}

try {
  runBin("initdb", ["-D", pgData, "-U", "postgres", "--auth=trust", "--no-instructions"], {
    stdio: "ignore",
  });
  runBin("pg_ctl", ["-D", pgData, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"], {
    stdio: "ignore",
  });
  started = true;

  sql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema private;
    create schema extensions;
    create extension if not exists pgcrypto with schema extensions;

    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function private.current_user_can_admin() returns boolean
    language sql security definer set search_path = '' stable as $$ select false $$;

    create table public.profiles (id uuid primary key);
    create table public.admin_audit_logs (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid references public.profiles(id),
      event_type text not null,
      target_type text,
      target_id uuid,
      summary text,
      metadata jsonb not null default '{}'::jsonb,
      operation_key text unique,
      created_at timestamptz not null default now()
    );
    create table public.ad_campaigns (
      id uuid primary key,
      advertiser_id uuid not null references public.profiles(id),
      status text not null,
      payment_status text not null,
      daily_budget_cents integer not null,
      platform_fee_cents integer not null default 0,
      prepaid_amount_cents integer not null default 0,
      stripe_checkout_session_id text,
      payment_dispute_hold boolean not null default false,
      payment_dispute_status text,
      payment_dispute_updated_at timestamptz,
      starts_at timestamptz,
      ends_at timestamptz,
      reviewer_note text,
      updated_at timestamptz not null default now()
    );
    create table public.ad_campaign_placements (
      id uuid primary key default gen_random_uuid(),
      campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
      placement text not null,
      unique (campaign_id, placement)
    );
    create table public.ad_events (
      id uuid primary key default gen_random_uuid(),
      campaign_id uuid not null,
      placement text not null,
      event_type text not null,
      foreign key (campaign_id, placement)
        references public.ad_campaign_placements(campaign_id, placement)
    );
    alter table public.ad_campaigns enable row level security;
    alter table public.ad_campaign_placements enable row level security;
    alter table public.ad_events enable row level security;
    create policy own_campaigns on public.ad_campaigns for select to authenticated
      using (advertiser_id = (select auth.uid()));
    create policy own_campaign_updates on public.ad_campaigns for update to authenticated
      using (advertiser_id = (select auth.uid()))
      with check (advertiser_id = (select auth.uid()));
    grant usage on schema public, auth, private to anon, authenticated, service_role;
    grant select on public.ad_campaigns, public.ad_campaign_placements,
      public.ad_events to anon;
    grant select, update on public.ad_campaigns to authenticated;
    grant all on public.profiles, public.admin_audit_logs, public.ad_campaigns,
      public.ad_campaign_placements, public.ad_events to service_role;

    insert into public.profiles (id) values
      ('${profileId}'),
      ('${otherProfileId}'),
      ('${holdSpendProfileId}'),
      ('${partialRefundProfileId}'),
      ('${fullySpentProfileId}'),
      ('${appleReversalProfileId}'),
      ('${googleTombstoneProfileId}'),
      ('${concurrentProfileId}');
  `);
  sql(readFileSync(path.join(root, "supabase/migrations/20260715033000_ad_credit_ledger.sql"), "utf8"));
  sql(`
    alter table public.ad_credit_ledger add column operation_id uuid default gen_random_uuid();
    create unique index ad_credit_ledger_operation_id_uidx
      on public.ad_credit_ledger (operation_id);
    drop policy if exists "Admins can create ad credits" on public.ad_credit_ledger;
    revoke insert on public.ad_credit_ledger from authenticated;
  `);
  sql(readFileSync(path.join(root, "supabase/migrations/20260715041500_spend_ad_credit_for_campaign.sql"), "utf8"));
  sql(migrationSource);

  for (const role of ["public", "anon", "authenticated"]) {
    assert.equal(
      scalar(`select has_function_privilege('${role}', 'public.grant_verified_ad_credit_purchase(text,text,text,uuid,integer,integer,text)', 'execute')::text;`),
      "false",
      `${role} cannot call the purchase grant RPC`,
    );
    assert.equal(
      scalar(`select has_function_privilege('${role}', 'public.reconcile_verified_ad_credit_purchase(text,text,text,text,text,text,text,uuid,integer,integer,boolean,integer,integer,text)', 'execute')::text;`),
      "false",
      `${role} cannot call the purchase reconciliation RPC`,
    );
    assert.equal(
      scalar(`select has_function_privilege('${role}', 'public.confirm_verified_ad_credit_purchase(uuid,text,text,text,uuid)', 'execute')::text;`),
      "false",
      `${role} cannot call the purchase confirmation RPC`,
    );
  }
  assert.equal(
    scalar(`select has_table_privilege('authenticated', 'public.ad_credit_ledger', 'INSERT')::text || ':' || has_table_privilege('authenticated', 'public.ad_credit_ledger', 'UPDATE')::text;`),
    "false:false",
    "authenticated callers have no direct ledger write grants",
  );

  for (const table of [
    "ad_credit_purchase_sources",
    "ad_credit_purchase_lifecycles",
    "ad_credit_purchase_events",
    "ad_credit_campaign_allocations",
  ]) {
    assert.equal(
      scalar(
        `select has_table_privilege('authenticated', 'public.${table}', 'SELECT')::text
          || ':' || has_table_privilege('authenticated', 'public.${table}', 'INSERT')::text
          || ':' || has_table_privilege('authenticated', 'public.${table}', 'UPDATE')::text;`,
      ),
      "false:false:false",
      `authenticated callers cannot read or mutate ${table}`,
    );
  }

  const appleTransactionId = "2000000000000001";
  const granted = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        origin: "apple_iap",
        providerCurrency: null,
        providerPaidAmountCents: null,
        providerTransactionId: appleTransactionId,
      })};`,
    ),
  );
  assert.match(granted, /^granted:[0-9a-f-]{36}$/);
  const grantedLedgerId = granted.split(":")[1];
  assert.equal(
    scalar(asRole("service_role", `
      select grant_id::text
      from public.confirm_verified_ad_credit_purchase(
        '${grantedLedgerId}', 'apple_iap', 'ttc.adcredit.2500',
        '${appleTransactionId}', '${profileId}'
      );
    `)),
    grantedLedgerId,
    "the durable grant id confirms only the exact purchase identity",
  );
  assert.equal(
    scalar(asRole("service_role", `
      select count(*)::text
      from public.confirm_verified_ad_credit_purchase(
        '${grantedLedgerId}', 'apple_iap', 'ttc.adcredit.2500',
        '${appleTransactionId}', '${otherProfileId}'
      );
    `)),
    "0",
    "a grant id cannot confirm for a different authenticated profile",
  );
  for (const [label, argumentsSql] of [
    [
      "grant id",
      `'${otherProfileId}', 'apple_iap', 'ttc.adcredit.2500',
        '${appleTransactionId}', '${profileId}'`,
    ],
    [
      "origin",
      `'${grantedLedgerId}', 'google_play', 'ttc.adcredit.2500',
        '${appleTransactionId}', '${profileId}'`,
    ],
    [
      "product",
      `'${grantedLedgerId}', 'apple_iap', 'ttc.adcredit.5000',
        '${appleTransactionId}', '${profileId}'`,
    ],
    [
      "provider transaction",
      `'${grantedLedgerId}', 'apple_iap', 'ttc.adcredit.2500',
        '2000000000000002', '${profileId}'`,
    ],
  ]) {
    assert.equal(
      scalar(asRole("service_role", `
        select count(*)::text
        from public.confirm_verified_ad_credit_purchase(${argumentsSql});
      `)),
      "0",
      `confirmation rejects a mismatched ${label}`,
    );
  }
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${grantPurchaseSql({
          origin: "apple_iap",
          providerCurrency: null,
          providerPaidAmountCents: null,
          providerTransactionId: appleTransactionId,
        })};`,
      ),
    ),
    `duplicate:${grantedLedgerId}`,
    "identical provider replay is idempotent",
  );
  assert.equal(
    scalar(`select credit_origin || ':' || provider_product_id || ':' || amount_cents || ':' || used_cents || ':' || campaign_spent_cents || ':' || refundable_cents || ':' || (expires_at is null)::text from public.ad_credit_ledger where id = '${grantedLedgerId}';`),
    "apple_iap:ttc.adcredit.2500:2500:0:0:2500:true",
    "purchased credit is non-expiring and fully refundable before spend",
  );

  expectSqlError(
    asRole("service_role", `${grantPurchaseSql({
      creditCents: 5000,
      origin: "apple_iap",
      productId: "ttc.adcredit.5000",
      profileId: otherProfileId,
      providerCurrency: null,
      providerPaidAmountCents: null,
      providerTransactionId: appleTransactionId,
    })};`),
    /purchase identity conflict|invalid/i,
    "a provider transaction cannot move accounts or products",
  );
  expectSqlError(
    asRole("service_role", `update public.ad_credit_ledger set profile_id = '${otherProfileId}' where id = '${grantedLedgerId}';`),
    /immutable|purchase identity/i,
    "trusted writers cannot mutate purchase identity",
  );
  expectSqlError(
    asRole("service_role", `update public.ad_credit_ledger set expires_at = now() where id = '${grantedLedgerId}';`),
    /non-expiring|check constraint|immutable/i,
    "purchased credit cannot be given an expiration",
  );

  const refundBeforeGrantTransaction = "pi_refundbeforegrant123";
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql(
          {
            action: "terminal_void",
            providerEventId: "evt_refundbeforegrant123",
            providerLifecycleId: "ch_refundbeforegrant123",
            providerTransactionId: refundBeforeGrantTransaction,
            reason: "refund",
          },
          `outcome || ':' || purchase_state || ':' || (ledger_id is null)::text`,
        )};`,
      ),
    ),
    "terminal_voided:terminal_void:true",
    "a terminal refund is durable before any grant exists",
  );
  const refundBeforeGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        providerTransactionId: refundBeforeGrantTransaction,
      })};`,
    ),
  );
  assert.match(refundBeforeGrant, /^granted:[0-9a-f-]{36}$/);
  const refundBeforeGrantLedgerId = refundBeforeGrant.split(":")[1];
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || campaign_spent_cents || ':' || refundable_cents || ':' || status from public.ad_credit_ledger where id = '${refundBeforeGrantLedgerId}';`),
    "terminal_void:2500:0:0:voided",
    "grant atomically applies a pre-existing terminal tombstone",
  );

  const disputeBeforeGrantTransaction = "pi_disputebeforegrant123";
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          providerEventAmountCents: 1000,
          providerEventId: "evt_disputebeforegrant123",
          providerLifecycleId: "dp_disputebeforegrant123",
          providerTransactionId: disputeBeforeGrantTransaction,
          reconciliationCreditCents: 1000,
        })};`,
      ),
    ),
    "held",
  );
  const disputeBeforeGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        providerTransactionId: disputeBeforeGrantTransaction,
      })};`,
    ),
  );
  const disputeBeforeGrantLedgerId = disputeBeforeGrant.split(":")[1];
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || campaign_spent_cents || ':' || refundable_cents || ':' || status from public.ad_credit_ledger where id = '${disputeBeforeGrantLedgerId}';`),
    "held:1000:0:1500:active",
    "grant atomically reserves only the amount held before grant",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "release",
          providerEventAmountCents: 1000,
          providerEventId: "evt_disputebeforegrantrelease123",
          providerLifecycleId: "dp_disputebeforegrant123",
          providerTransactionId: disputeBeforeGrantTransaction,
          reconciliationCreditCents: 1000,
        })};`,
      ),
    ),
    "released",
  );
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${disputeBeforeGrantLedgerId}';`),
    "available:0:2500",
    "a paired release restores only its stable dispute hold",
  );

  const holdSpendTransaction = "pi_holdspend123456789";
  const holdSpendGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        profileId: holdSpendProfileId,
        providerTransactionId: holdSpendTransaction,
      })};`,
    ),
  );
  const holdSpendLedgerId = holdSpendGrant.split(":")[1];
  const holdSpendCampaignId = "20000000-0000-4000-8000-000000000910";
  sql(`insert into public.ad_campaigns (id, advertiser_id, status, payment_status, daily_budget_cents) values ('${holdSpendCampaignId}', '${holdSpendProfileId}', 'approved', 'unpaid', 1000);`);
  assert.equal(
    scalar(
      asRole(
        "authenticated",
        `select public.spend_ad_credit_for_campaign('${holdSpendCampaignId}');`,
        holdSpendProfileId,
      ),
    ),
    "t",
  );
  assert.equal(
    scalar(`select used_cents || ':' || campaign_spent_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${holdSpendLedgerId}';`),
    "1000:1000:1500",
    "spend records actual campaign allocation separately from unavailable credit",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          providerEventId: "evt_holdspend123456789",
          providerLifecycleId: "dp_holdspend123456789",
          providerTransactionId: holdSpendTransaction,
          profileId: holdSpendProfileId,
        })};`,
      ),
    ),
    "held",
  );
  assert.equal(
    scalar(`select spent_hold_cents || ':' || spent_terminal_loss_cents from public.ad_credit_purchase_sources where provider_transaction_id = '${holdSpendTransaction}';`),
    "1000:0",
    "a full dispute hold captures the already-spent exposure",
  );
  assert.equal(
    scalar(`select ad_credit_purchase_hold::text || ':' || ad_credit_purchase_hold_cents || ':' || ad_credit_purchase_debt_cents from public.ad_campaigns where id = '${holdSpendCampaignId}';`),
    "true:1000:0",
    "spent disputed credit immediately blocks the funded campaign",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "release",
          providerEventId: "evt_holdspendrelease123456789",
          providerLifecycleId: "dp_holdspend123456789",
          providerTransactionId: holdSpendTransaction,
          profileId: holdSpendProfileId,
        })};`,
      ),
    ),
    "released",
  );
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || campaign_spent_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${holdSpendLedgerId}';`),
    "available:1000:1000:1500",
    "release removes only temporary hold reserves",
  );
  assert.equal(
    scalar(`select ad_credit_purchase_hold::text || ':' || ad_credit_purchase_hold_cents || ':' || ad_credit_purchase_debt_cents from public.ad_campaigns where id = '${holdSpendCampaignId}';`),
    "false:0:0",
  );

  const partialRefundTransaction = "pi_partialrefund123456";
  const partialRefundGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        profileId: partialRefundProfileId,
        providerTransactionId: partialRefundTransaction,
      })};`,
    ),
  );
  const partialRefundLedgerId = partialRefundGrant.split(":")[1];
  const partialRefundCampaignId = "20000000-0000-4000-8000-000000000911";
  sql(`insert into public.ad_campaigns (id, advertiser_id, status, payment_status, daily_budget_cents) values ('${partialRefundCampaignId}', '${partialRefundProfileId}', 'approved', 'unpaid', 1000);`);
  assert.equal(
    scalar(
      asRole(
        "authenticated",
        `select public.spend_ad_credit_for_campaign('${partialRefundCampaignId}');`,
        partialRefundProfileId,
      ),
    ),
    "t",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "terminal_void",
          providerEventAmountCents: 500,
          providerEventId: "evt_partialrefund500",
          providerLifecycleId: "ch_partialrefund123456",
          providerTransactionId: partialRefundTransaction,
          profileId: partialRefundProfileId,
          reason: "refund",
          reconciliationCreditCents: 500,
        })};`,
      ),
    ),
    "partially_voided",
  );
  assert.equal(
    scalar(`select used_cents || ':' || campaign_spent_cents || ':' || refundable_cents || ':' || purchase_reconciliation_state from public.ad_credit_ledger where id = '${partialRefundLedgerId}';`),
    "1500:1000:1000:partially_voided",
    "a partial refund reserves exactly its cumulative amount",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "terminal_void",
          providerEventAmountCents: 400,
          providerEventId: "evt_partialrefundstale400",
          providerLifecycleId: "ch_partialrefund123456",
          providerTransactionId: partialRefundTransaction,
          profileId: partialRefundProfileId,
          reason: "refund",
          reconciliationCreditCents: 400,
        })};`,
      ),
    ),
    "stale",
    "out-of-order cumulative refund amounts cannot decrease terminal loss",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "terminal_void",
          providerEventAmountCents: 2000,
          providerEventId: "evt_partialrefund2000",
          providerLifecycleId: "ch_partialrefund123456",
          providerTransactionId: partialRefundTransaction,
          profileId: partialRefundProfileId,
          reason: "refund",
          reconciliationCreditCents: 2000,
        })};`,
      ),
    ),
    "partially_voided",
  );
  assert.equal(
    scalar(`select used_cents || ':' || campaign_spent_cents || ':' || refundable_cents || ':' || status from public.ad_credit_ledger where id = '${partialRefundLedgerId}';`),
    "2500:1000:0:voided",
  );
  assert.equal(
    scalar(`select terminal_void_cents || ':' || spent_terminal_loss_cents from public.ad_credit_purchase_sources where provider_transaction_id = '${partialRefundTransaction}';`),
    "2000:500",
    "terminal loss beyond remaining credit becomes durable purchased-credit debt",
  );
  assert.equal(
    scalar(`select ad_credit_purchase_hold::text || ':' || ad_credit_purchase_debt_cents || ':' || ad_credit_purchase_hold_cents from public.ad_campaigns where id = '${partialRefundCampaignId}';`),
    "true:500:0",
    "the exact spent portion of a partial refund blocks campaign serving",
  );
  sql(`update public.ad_campaigns set status = 'active' where id = '${partialRefundCampaignId}';`);
  assert.equal(
    scalar(asRole("anon", `select count(*)::text from public.ad_campaigns where id = '${partialRefundCampaignId}';`)),
    "0",
    "allocation-backed debt is enforced by the active-ad read boundary",
  );

  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "terminal_void",
          providerEventAmountCents: 2000,
          providerEventId: "evt_partialrefund2000",
          providerLifecycleId: "ch_partialrefund123456",
          providerTransactionId: partialRefundTransaction,
          profileId: partialRefundProfileId,
          reason: "refund",
          reconciliationCreditCents: 2000,
        })};`,
      ),
    ),
    "duplicate",
    "an exact callback replay includes action and all amount identity",
  );
  assert.equal(
    scalar(`select count(*)::text || ':' || min(event_type) || ':' || min(target_type) from public.admin_audit_logs where operation_key = 'ad-credit-purchase-event:' || (select id::text from public.ad_credit_purchase_events where credit_origin = 'stripe_web' and provider_event_id = 'evt_partialrefund2000');`),
    "1:ad_credit_purchase_refund:ad_credit_purchase",
    "provider event replay keeps one durable operator audit row",
  );
  assert.equal(
    scalar(`select (metadata ? 'provider_event_id')::text || ':' || (metadata ? 'provider_transaction_id')::text || ':' || (position('evt_partialrefund2000' in operation_key) = 0)::text from public.admin_audit_logs where operation_key = 'ad-credit-purchase-event:' || (select id::text from public.ad_credit_purchase_events where credit_origin = 'stripe_web' and provider_event_id = 'evt_partialrefund2000');`),
    "false:false:true",
    "operator-visible audit data does not expose provider transaction identifiers",
  );
  expectSqlError(
    asRole(
      "service_role",
      `${reconcilePurchaseSql({
        action: "release",
        providerEventAmountCents: 2000,
        providerEventId: "evt_partialrefund2000",
        providerLifecycleId: "dp_conflictingevent123",
        providerTransactionId: partialRefundTransaction,
        profileId: partialRefundProfileId,
        reconciliationCreditCents: 2000,
      })};`,
    ),
    /event identity conflict/i,
    "a callback event id cannot be replayed with a conflicting action",
  );
  scalar(
    asRole(
      "service_role",
      `${reconcilePurchaseSql({
        action: "release",
        providerEventAmountCents: 500,
        providerEventId: "evt_releaseafterrefund123",
        providerLifecycleId: "dp_releaseafterrefund123",
        providerTransactionId: partialRefundTransaction,
        profileId: partialRefundProfileId,
        reconciliationCreditCents: 500,
      })};`,
    ),
  );
  assert.equal(
    scalar(`select terminal_void_cents || ':' || spent_terminal_loss_cents from public.ad_credit_purchase_sources where provider_transaction_id = '${partialRefundTransaction}';`),
    "2000:500",
    "a dispute release cannot override terminal refund debt",
  );

  const fullySpentTransaction = "pi_fullyspentrefund123";
  const fullySpentGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        profileId: fullySpentProfileId,
        providerTransactionId: fullySpentTransaction,
      })};`,
    ),
  );
  const fullySpentLedgerId = fullySpentGrant.split(":")[1];
  const fullySpentCampaignId = "20000000-0000-4000-8000-000000000912";
  sql(`insert into public.ad_campaigns (id, advertiser_id, status, payment_status, daily_budget_cents) values ('${fullySpentCampaignId}', '${fullySpentProfileId}', 'approved', 'unpaid', 2500);`);
  assert.equal(
    scalar(
      asRole(
        "authenticated",
        `select public.spend_ad_credit_for_campaign('${fullySpentCampaignId}');`,
        fullySpentProfileId,
      ),
    ),
    "t",
  );
  scalar(
    asRole(
      "service_role",
      `${reconcilePurchaseSql({
        action: "terminal_void",
        providerEventId: "evt_fullyspentrefund123",
        providerLifecycleId: "ch_fullyspentrefund123",
        providerTransactionId: fullySpentTransaction,
        profileId: fullySpentProfileId,
        reason: "refund",
      })};`,
    ),
  );
  assert.equal(
    scalar(`select campaign_spent_cents || ':' || used_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${fullySpentLedgerId}';`),
    "2500:2500:0",
  );
  assert.equal(
    scalar(`select spent_terminal_loss_cents::text from public.ad_credit_purchase_sources where provider_transaction_id = '${fullySpentTransaction}';`),
    "2500",
    "fully spent refunded credit becomes fully collectible debt",
  );
  assert.equal(
    scalar(`select ad_credit_purchase_hold::text || ':' || ad_credit_purchase_debt_cents from public.ad_campaigns where id = '${fullySpentCampaignId}';`),
    "true:2500",
    "a fully funded campaign cannot silently survive terminal payment loss",
  );

  const appleReversalTransaction = "2000000000000099";
  const appleReversalGrant = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        origin: "apple_iap",
        profileId: appleReversalProfileId,
        providerCurrency: null,
        providerPaidAmountCents: null,
        providerTransactionId: appleReversalTransaction,
      })};`,
    ),
  );
  const appleReversalLedgerId = appleReversalGrant.split(":")[1];
  const appleReconciliation = {
    action: "terminal_void",
    fullPurchase: true,
    origin: "apple_iap",
    productId: "ttc.adcredit.2500",
    profileId: appleReversalProfileId,
    providerEventAmountCents: null,
    providerCurrency: null,
    providerEventId: "apple:00000000-0000-4000-8000-000000000920",
    providerLifecycleId: `apple-refund:${appleReversalTransaction}`,
    providerPaidAmountCents: null,
    providerTransactionId: appleReversalTransaction,
    purchaseCreditCents: 2500,
    reason: "refund",
    reconciliationCreditCents: 2500,
  };
  assert.equal(
    scalar(asRole("service_role", `${reconcilePurchaseSql(appleReconciliation)};`)),
    "terminal_voided",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          ...appleReconciliation,
          action: "refund_reverse",
          providerEventId: "apple:00000000-0000-4000-8000-000000000921",
        })};`,
      ),
    ),
    "refund_reversed",
  );
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${appleReversalLedgerId}';`),
    "available:0:2500",
    "only Apple's explicit refund reversal restores its matching refund case",
  );
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          ...appleReconciliation,
          providerEventId: "apple:00000000-0000-4000-8000-000000000922",
        })};`,
      ),
    ),
    "refund_reversed",
    "a stale refund after its explicit reversal cannot re-void credit",
  );
  scalar(
    asRole(
      "service_role",
      `${reconcilePurchaseSql({
        ...appleReconciliation,
        providerEventId: "apple:00000000-0000-4000-8000-000000000923",
        providerLifecycleId: `apple-revoke:${appleReversalTransaction}`,
        reason: "revocation",
      })};`,
    ),
  );
  scalar(
    asRole(
      "service_role",
      `${reconcilePurchaseSql({
        ...appleReconciliation,
        action: "refund_reverse",
        providerEventId: "apple:00000000-0000-4000-8000-000000000924",
      })};`,
    ),
  );
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || refundable_cents from public.ad_credit_ledger where id = '${appleReversalLedgerId}';`),
    "terminal_void:0",
    "refund reversal cannot reactivate a separate terminal revocation",
  );

  const googleBeforeGrantToken = "google-play-token-before-grant-123456789";
  assert.equal(
    scalar(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          action: "terminal_void",
          fullPurchase: true,
          origin: "google_play",
          productId: null,
          profileId: null,
          providerEventAmountCents: null,
          providerCurrency: null,
          providerEventId: "google:12345678901234567890",
          providerLifecycleId: "GPA.1234-5678-9012-34567",
          providerPaidAmountCents: null,
          providerTransactionId: googleBeforeGrantToken,
          purchaseCreditCents: null,
          reason: "refund",
          reconciliationCreditCents: null,
        })};`,
      ),
    ),
    "terminal_voided",
    "a full Google revocation can create an identity-light pre-grant tombstone",
  );
  const googleAfterTombstone = scalar(
    asRole(
      "service_role",
      `${grantPurchaseSql({
        origin: "google_play",
        profileId: googleTombstoneProfileId,
        providerCurrency: null,
        providerPaidAmountCents: null,
        providerTransactionId: googleBeforeGrantToken,
      })};`,
    ),
  );
  const googleAfterTombstoneLedgerId = googleAfterTombstone.split(":")[1];
  assert.equal(
    scalar(`select purchase_reconciliation_state || ':' || used_cents || ':' || refundable_cents from public.ad_credit_ledger where id = '${googleAfterTombstoneLedgerId}';`),
    "terminal_void:2500:0",
  );

  for (const [invalidIndex, invalidInput] of [
    { action: "void" },
    { action: "reinstate" },
    { providerCurrency: "USD" },
    { providerEventAmountCents: 2501, reconciliationCreditCents: 2501 },
    { providerLifecycleId: "not.is.null" },
  ].entries()) {
    expectSqlError(
      asRole(
        "service_role",
        `${reconcilePurchaseSql({
          providerEventId: `evt_invalid_purchase_${invalidIndex}`,
          ...invalidInput,
        })};`,
      ),
      /invalid ad credit purchase reconciliation/i,
      "malicious lifecycle and amount input fails closed",
    );
  }

  const concurrentTransaction = "pi_concurrentorder123";
  const concurrentSourceLock = `select pg_advisory_xact_lock(
    hashtextextended('ad-credit-source:stripe_web:${concurrentTransaction}', 0)
  );`;
  const reversalFirst = sqlAsync(`
    begin;
    set role service_role;
    ${concurrentSourceLock}
    ${reconcilePurchaseSql({
      action: "terminal_void",
      providerEventId: "evt_concurrentrefund123",
      providerLifecycleId: "ch_concurrentrefund123",
      providerTransactionId: concurrentTransaction,
      profileId: concurrentProfileId,
      reason: "refund",
    })};
    select pg_sleep(0.2);
    commit;
  `);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const grantSecond = sqlAsync(`
    set role service_role;
    ${grantPurchaseSql({
      profileId: concurrentProfileId,
      providerTransactionId: concurrentTransaction,
    })};
  `);
  await Promise.all([reversalFirst, grantSecond]);
  assert.equal(
    scalar(`select lifecycle_state || ':' || terminal_void_cents || ':' || (ledger_id is not null)::text from public.ad_credit_purchase_sources where provider_transaction_id = '${concurrentTransaction}';`),
    "terminal_void:2500:true",
    "concurrent reversal-first and grant-second ordering cannot expose credit",
  );

  const concurrentGrantFirstTransaction = "pi_concurrentgrantfirst123";
  const concurrentGrantFirstLock = `select pg_advisory_xact_lock(
    hashtextextended('ad-credit-source:stripe_web:${concurrentGrantFirstTransaction}', 0)
  );`;
  const grantFirst = sqlAsync(`
    begin;
    set role service_role;
    ${concurrentGrantFirstLock}
    ${grantPurchaseSql({
      profileId: concurrentProfileId,
      providerTransactionId: concurrentGrantFirstTransaction,
    })};
    select pg_sleep(0.2);
    commit;
  `);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const reversalSecond = sqlAsync(`
    set role service_role;
    ${reconcilePurchaseSql({
      action: "terminal_void",
      profileId: concurrentProfileId,
      providerEventId: "evt_concurrentgrantfirst123",
      providerLifecycleId: "ch_concurrentgrantfirst123",
      providerTransactionId: concurrentGrantFirstTransaction,
      reason: "refund",
    })};
  `);
  await Promise.all([grantFirst, reversalSecond]);
  assert.equal(
    scalar(`select lifecycle_state || ':' || terminal_void_cents || ':' || (ledger_id is not null)::text from public.ad_credit_purchase_sources where provider_transaction_id = '${concurrentGrantFirstTransaction}';`),
    "terminal_void:2500:true",
    "concurrent grant-first and reversal-second ordering reaches the same terminal state",
  );

  assert.equal(
    scalar(asRole("service_role", `select public.resolve_google_ad_purchase_profile(encode(extensions.digest('${profileId}', 'sha256'), 'hex'))::text;`)),
    profileId,
    "signed Google account bindings resolve to one profile",
  );
  console.log(`PASS ad credit purchase database contracts on disposable PostgreSQL ${port}`);
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
