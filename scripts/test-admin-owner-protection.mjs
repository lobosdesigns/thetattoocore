import assert from "node:assert/strict";
import {
  RedirectSignal,
  createRoleBoundaryClient,
  createSupabaseDouble,
  loadAdminActions,
  makeForm,
  testIds,
} from "./admin-module-test-harness.mjs";

function filterValue(query, column) {
  return query.filters.find(
    (filter) => filter.column === column && filter.operator === "eq",
  )?.value;
}

function ownerClient(targetRole) {
  return createSupabaseDouble({
    claims: {
      email: "owner@example.com",
      sub: testIds.actor,
    },
    execute(query) {
      if (query.table === "profiles" && query.operation === "select") {
        const profileId = filterValue(query, "id");

        if (profileId === testIds.actor) {
          return {
            data: {
              id: testIds.actor,
              role: "owner",
              username: "primary_owner",
            },
            error: null,
          };
        }

        if (profileId === testIds.other) {
          return {
            data: {
              banned_at: null,
              id: testIds.other,
              role: targetRole,
              suspended_at: null,
              username: "protected_owner",
            },
            error: null,
          };
        }
      }

      if (
        (query.table === "profiles" && query.operation === "update") ||
        (query.table === "admin_audit_logs" && query.operation === "insert") ||
        (query.table === "moderation_actions" && query.operation === "insert")
      ) {
        return { data: null, error: null };
      }

      throw new Error(
        `Unexpected ${query.operation ?? "query"} on ${query.table}`,
      );
    },
  });
}

async function captureOutcome(action, values) {
  try {
    await action(makeForm(values));
    throw new Error("Action returned without redirecting");
  } catch (error) {
    return error;
  }
}

let currentClient;
let privateAdminClientCalls = 0;
const { actions } = await loadAdminActions({
  createAdminClient() {
    privateAdminClientCalls += 1;
    throw new Error("Protected owner path reached private admin client");
  },
  async createClient() {
    return currentClient;
  },
});

{
  const roleClient = createRoleBoundaryClient("admin");
  currentClient = roleClient.client;
  const outcome = await captureOutcome(actions.changeUserRole, {
    profile_id: testIds.other,
    role: "owner",
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(decodeURIComponent(outcome.location.replaceAll("+", " ")), /valid user and role/i);
  assert.equal(
    roleClient.queries.length,
    0,
    "owner assignment must fail before authentication or database access",
  );
}
console.log("PASS owner is excluded from ordinary role assignment");

{
  const testClient = ownerClient("admin");
  currentClient = testClient.client;
  const outcome = await captureOutcome(actions.changeUserRole, {
    profile_id: testIds.actor,
    role: "admin",
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(decodeURIComponent(outcome.location.replaceAll("+", " ")), /cannot demote/i);
  assert.equal(
    testClient.queries.some((query) => query.operation === "update"),
    false,
  );
}
console.log("PASS owner cannot self-demote");

{
  const adminClient = createRoleBoundaryClient("admin");
  currentClient = adminClient.client;
  const outcome = await captureOutcome(actions.changeUserRole, {
    profile_id: testIds.other,
    role: "user",
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(decodeURIComponent(outcome.location.replaceAll("+", " ")), /Owner access required/i);
}
console.log("PASS admin cannot demote an owner through the owner-only role action");

{
  const testClient = ownerClient("owner");
  currentClient = testClient.client;
  const outcome = await captureOutcome(actions.changeUserRole, {
    profile_id: testIds.other,
    role: "admin",
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(
    decodeURIComponent(outcome.location.replaceAll("+", " ")),
    /Owner accounts cannot be demoted/i,
  );
  assert.equal(
    testClient.queries.some((query) => query.operation === "update"),
    false,
  );
}
console.log("PASS owner accounts cannot be demoted by another owner");

for (const status of ["suspended", "banned"]) {
  const testClient = ownerClient("owner");
  currentClient = testClient.client;
  const outcome = await captureOutcome(actions.changeUserStatus, {
    profile_id: testIds.other,
    status,
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(
    decodeURIComponent(outcome.location.replaceAll("+", " ")),
    /cannot be suspended or banned/i,
  );
  assert.equal(
    testClient.queries.some((query) => query.operation === "update"),
    false,
  );
}
console.log("PASS protected owners cannot be suspended or banned");

{
  const testClient = ownerClient("owner");
  currentClient = testClient.client;
  const outcome = await captureOutcome(actions.deleteUserAccount, {
    confirm_delete: "delete",
    profile_id: testIds.other,
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(
    decodeURIComponent(outcome.location.replaceAll("+", " ")),
    /Owner accounts cannot be deleted/i,
  );
  assert.equal(privateAdminClientCalls, 0);
}
console.log("PASS protected and final owner accounts cannot be deleted");

{
  const testClient = ownerClient("admin");
  currentClient = testClient.client;
  const outcome = await captureOutcome(actions.changeUserRole, {
    profile_id: testIds.other,
    role: "admin",
  });

  assert.ok(outcome instanceof RedirectSignal);
  assert.match(decodeURIComponent(outcome.location.replaceAll("+", " ")), /already has that role/i);
  assert.equal(
    testClient.queries.some(
      (query) => query.table === "profiles" && query.operation === "update",
    ),
    false,
    "a repeated role submission must not rewrite the profile",
  );
  assert.equal(
    testClient.queries.some(
      (query) =>
        query.table === "admin_audit_logs" && query.operation === "insert",
    ),
    false,
    "a repeated role submission must not append a duplicate success audit",
  );
}
console.log("PASS repeated role changes are idempotent and do not duplicate audits");
