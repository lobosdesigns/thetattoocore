import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  RedirectSignal,
  createSupabaseDouble,
  loadAdminActions,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

const capturedLogs = [];
let currentClient;
let currentAdminClient = null;

const { actions } = await loadAdminActions({
  console: {
    error(...args) {
      capturedLogs.push(args.map(String).join(" "));
    },
    log() {},
    warn(...args) {
      capturedLogs.push(args.map(String).join(" "));
    },
  },
  createAdminClient() {
    return currentAdminClient;
  },
  async createClient() {
    return currentClient;
  },
});

function ownerClient(execute) {
  return createSupabaseDouble({
    claims: {
      email: "owner@example.com",
      sub: testIds.actor,
    },
    execute(query) {
      const actorRoleLookup =
        query.table === "profiles" &&
        query.operation === "select" &&
        query.selection === "role" &&
        query.filters.some(
          ({ column, value }) => column === "id" && value === testIds.actor,
        );

      if (actorRoleLookup) {
        return { data: { role: "owner" }, error: null };
      }

      return execute(query);
    },
  });
}

async function expectRedirect(operation) {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof RedirectSignal, `Expected redirect, got ${error}`);
    return error.location;
  }

  assert.fail("Expected action to terminate through redirect");
}

{
  const auditRows = [];
  const roleClient = ownerClient((query) => {
    if (
      query.table === "profiles" &&
      query.operation === "select" &&
      query.selection === "id, role"
    ) {
      return {
        data: { id: testIds.other, role: "user" },
        error: null,
      };
    }

    if (query.table === "profiles" && query.operation === "update") {
      return { data: null, error: null };
    }

    if (query.table === "admin_audit_logs" && query.operation === "insert") {
      auditRows.push(query.payload);
      return { data: null, error: null };
    }

    throw new Error(`Unexpected role-change query on ${query.table}`);
  });
  currentClient = roleClient.client;

  await expectRedirect(() =>
    actions.changeUserRole(
      makeForm({
        actor_id: testIds.third,
        created_at: "1999-01-01T00:00:00.000Z",
        event_type: "forged_event",
        profile_id: testIds.other,
        role: "moderator",
        target_type: "forged_target",
      }),
    ),
  );

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].actor_id, testIds.actor);
  assert.equal(auditRows[0].event_type, "profile_role_changed");
  assert.equal(auditRows[0].target_id, testIds.other);
  assert.equal(auditRows[0].target_type, "profile");
  assert.equal("created_at" in auditRows[0], false);
}
console.log("PASS role-change audits derive actor/action/target on the server");

{
  const auditRows = [];
  const testerClient = ownerClient((query) => {
    if (
      query.table === "profiles" &&
      query.operation === "select" &&
      query.selection === "id"
    ) {
      return { data: null, error: null };
    }

    if (query.table === "profiles" && query.operation === "update") {
      return { data: null, error: null };
    }

    if (query.table === "admin_audit_logs" && query.operation === "insert") {
      auditRows.push(query.payload);
      return { data: null, error: null };
    }

    throw new Error(`Unexpected tester-account query on ${query.table}`);
  });
  currentClient = testerClient.client;
  currentAdminClient = {
    auth: {
      admin: {
        async createUser() {
          return {
            data: { user: { id: testIds.third } },
            error: null,
          };
        },
        async deleteUser() {
          return { data: null, error: null };
        },
      },
    },
  };
  const privateEmail = "private.tester@example.com";
  const privatePassword = "private-password-value";

  await expectRedirect(() =>
    actions.createTestAccount(
      makeForm({
        account_type: "artist",
        display_name: "Fixture Artist",
        email: privateEmail,
        password: privatePassword,
        username: "fixture_artist",
      }),
    ),
  );

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].actor_id, testIds.actor);
  assert.equal(auditRows[0].event_type, "tester_account_created");
  assert.equal(auditRows[0].target_id, testIds.third);
  assert.equal(auditRows[0].target_type, "profile");
  assert.equal("created_at" in auditRows[0], false);
  assert.equal(JSON.stringify(auditRows[0]).includes(privateEmail), false);
  assert.equal(JSON.stringify(auditRows[0]).includes(privatePassword), false);
}
console.log("PASS tester-account audits exclude email, password, and caller timestamps");

{
  const deniedClient = createSupabaseDouble({
    claims: {
      email: "user@example.com",
      sub: testIds.actor,
    },
    execute(query) {
      if (query.table === "profiles" && query.operation === "select") {
        return { data: { role: "user" }, error: null };
      }

      throw new Error(`Denied action reached ${query.operation} on ${query.table}`);
    },
  });
  currentClient = deniedClient.client;

  await expectRedirect(() =>
    actions.changeUserRole(
      makeForm({
        profile_id: testIds.other,
        role: "moderator",
      }),
    ),
  );

  assert.equal(
    deniedClient.queries.some(
      ({ operation, table }) =>
        operation === "insert" && table === "admin_audit_logs",
    ),
    false,
  );
}
console.log("PASS denied privileged actions do not create success audit rows");

{
  const privateValue = "provider-private-value";
  capturedLogs.length = 0;
  const failureClient = ownerClient((query) => {
    if (
      query.table === "profiles" &&
      query.operation === "select" &&
      query.selection === "id"
    ) {
      return { data: null, error: null };
    }

    throw new Error(`Unexpected failure-path query on ${query.table}`);
  });
  currentClient = failureClient.client;
  currentAdminClient = {
    auth: {
      admin: {
        async createUser() {
          return {
            data: { user: null },
            error: new Error(privateValue),
          };
        },
      },
    },
  };

  await expectRedirect(() =>
    actions.createTestAccount(
      makeForm({
        account_type: "artist",
        display_name: "Fixture Artist",
        email: "fixture@example.com",
        password: "fixture-password",
        username: "fixture_artist",
      }),
    ),
  );

  assert.equal(capturedLogs.join("\n").includes(privateValue), false);
}
console.log("PASS privileged action logs redact backend and provider details");

{
  const actionSource = await readFile("src/app/admin/actions.ts", "utf8");
  const sourceFile = ts.createSourceFile(
    "actions.ts",
    actionSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const unsafeConsoleCalls = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "console" &&
      node.expression.name.text === "error" &&
      (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))
    ) {
      unsafeConsoleCalls.push(
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.deepEqual(
    unsafeConsoleCalls,
    [],
    `console.error must use static messages only; unsafe lines: ${unsafeConsoleCalls.join(", ")}`,
  );
}
console.log("PASS privileged action error logs contain static messages only");

{
  const foundation = await readFile(
    "supabase/migrations/20260707_admin_foundation.sql",
    "utf8",
  );
  const grants = await readFile(
    "supabase/migrations/20260707_tighten_admin_grants.sql",
    "utf8",
  );
  const hardening = await readFile(
    "supabase/migrations/20260730120000_harden_privileged_admin_policies.sql",
    "utf8",
  );

  assert.match(
    foundation,
    /created_at timestamptz not null default now\(\)/i,
  );
  assert.match(
    grants,
    /grant select, insert on public\.admin_audit_logs to authenticated;/i,
  );
  assert.doesNotMatch(
    grants,
    /grant[^;]*(?:update|delete)[^;]*admin_audit_logs/i,
  );
  assert.match(
    hardening,
    /private\.current_user_can_admin\(\)[\s\S]*private\.current_user_can_moderate\(\)[\s\S]*actor_id = \(select auth\.uid\(\)\)/i,
  );
  for (const eventType of [
    "help_comment_pending_review",
    "help_comment_visible",
    "help_comment_hidden",
    "help_comment_removed",
    "license_approved",
    "license_rejected",
    "account_deletion_reviewing",
    "account_deletion_rejected",
    "account_deletion_cancelled",
  ]) {
    assert.match(hardening, new RegExp(`'${eventType}'`, "i"));
  }
  assert.match(
    hardening,
    /mail_settings for update[\s\S]*private\.current_user_is_owner\(\)/i,
  );
}
console.log(
  "PASS database policy preserves server timestamps, immutable audits, staff audit inserts, and owner-only mail configuration",
);
