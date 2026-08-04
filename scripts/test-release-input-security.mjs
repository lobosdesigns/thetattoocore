import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { readBoundedRequestBytes } from "../src/lib/http/bounded-request-body.mjs";

const actorId = "00000000-0000-4000-8000-000000000101";
const otherId = "00000000-0000-4000-8000-000000000202";
const installationId = "00000000-0000-4000-8000-000000000303";

function moduleContext() {
  return {
    AbortController,
    Blob,
    DOMException,
    File,
    FormData,
    Headers,
    Request,
    Response,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    crypto,
    fetch,
    process,
    queueMicrotask,
    setInterval,
    setTimeout,
    structuredClone,
  };
}

async function importTypeScriptWithStubs(relativePath, stubs = {}) {
  const absolutePath = resolve(relativePath);
  const source = await readFile(absolutePath, "utf8");
  const outputText = stripTypeScriptTypes(source, {
    mode: "transform",
    sourceMap: false,
  });
  const context = vm.createContext(moduleContext());
  const moduleCache = new Map();
  const sourceModule = new vm.SourceTextModule(outputText, {
    context,
    identifier: pathToFileURL(absolutePath).href,
  });

  await sourceModule.link(async (specifier) => {
    if (moduleCache.has(specifier)) return moduleCache.get(specifier);

    const exports = stubs[specifier];
    if (!exports) throw new Error(`Missing test stub for ${specifier}`);

    const names = Object.keys(exports);
    const stubModule = new vm.SyntheticModule(
      names,
      function initializeStub() {
        for (const name of names) this.setExport(name, exports[name]);
      },
      { context, identifier: `stub:${specifier}` },
    );
    moduleCache.set(specifier, stubModule);
    return stubModule;
  });
  await sourceModule.evaluate();

  return sourceModule.namespace;
}

class QueryDouble {
  constructor(table, execute) {
    this.execute = execute;
    this.state = {
      filters: [],
      operation: null,
      options: undefined,
      payload: undefined,
      selection: null,
      table,
    };
  }

  delete() {
    this.state.operation = "delete";
    return this;
  }

  eq(column, value) {
    this.state.filters.push({ column, operator: "eq", value });
    return this;
  }

  in(column, value) {
    this.state.filters.push({ column, operator: "in", value });
    return this;
  }

  maybeSingle() {
    return this.run("maybeSingle");
  }

  neq(column, value) {
    this.state.filters.push({ column, operator: "neq", value });
    return this;
  }

  or(value) {
    this.state.filters.push({ operator: "or", value });
    return this;
  }

  order(column, options) {
    this.state.order = { column, options };
    return this;
  }

  select(selection) {
    this.state.operation ??= "select";
    this.state.selection = selection;
    return this;
  }

  single() {
    return this.run("single");
  }

  then(onFulfilled, onRejected) {
    return this.run("await").then(onFulfilled, onRejected);
  }

  update(payload) {
    this.state.operation = "update";
    this.state.payload = payload;
    return this;
  }

  upsert(payload, options) {
    this.state.operation = "upsert";
    this.state.options = options;
    this.state.payload = payload;
    return this;
  }

  run(terminal) {
    return Promise.resolve().then(() =>
      this.execute({
        ...this.state,
        filters: [...this.state.filters],
        terminal,
      }),
    );
  }
}

function createClientDouble({ claims, execute, rpc }) {
  const queries = [];
  const rpcCalls = [];
  const client = {
    auth: {
      async getClaims() {
        return {
          data: claims ? { claims } : null,
          error: null,
        };
      },
      async signOut(options) {
        client.signOutOptions = options;
        return { error: null };
      },
    },
    from(table) {
      return new QueryDouble(table, async (query) => {
        queries.push(query);
        return execute(query);
      });
    },
    async rpc(name, payload) {
      rpcCalls.push({ name, payload });
      return rpc ? rpc(name, payload) : { data: null, error: null };
    },
  };

  return { client, queries, rpcCalls };
}

function assertFilter(query, column, operator, value) {
  assert.ok(
    query.filters.some(
      (filter) =>
        filter.column === column &&
        filter.operator === operator &&
        filter.value === value,
    ),
    `expected ${query.operation} on ${query.table} to include ${column} ${operator} ${value}`,
  );
}

const cookieWrites = [];
const NextResponse = {
  json(body, options = {}) {
    const response = Response.json(body, options);
    response.cookies = {
      set(...values) {
        cookieWrites.push(values);
      },
    };
    return response;
  },
  redirect(url, { status } = {}) {
    const response = new Response(null, {
      headers: { location: String(url) },
      status: status ?? 307,
    });
    response.cookies = {
      set(...values) {
        cookieWrites.push(values);
      },
    };
    return response;
  },
};

const deviceCookieModule = await importTypeScriptWithStubs(
  "src/lib/device-alert-cookies.ts",
);

let nativeAdmin;
const nativeClaimsClient = createClientDouble({
  claims: { sub: actorId },
  execute() {
    throw new Error("Native claims client must not query tables.");
  },
});
const nativeRoute = await importTypeScriptWithStubs(
  "src/app/api/push/devices/route.ts",
  {
    "@/lib/device-alert-cookies": {
      deviceAlertCookieOptions: deviceCookieModule.deviceAlertCookieOptions,
      nativePushCookieValue: deviceCookieModule.nativePushCookieValue,
      nativePushDeviceCookie: deviceCookieModule.nativePushDeviceCookie,
      validDeviceAlertUuid: deviceCookieModule.validDeviceAlertUuid,
    },
    "@/lib/http/bounded-request-body.mjs": {
      readBoundedRequestBytes,
    },
    "@/lib/native-push/qa-access": {
      nativePushQaBuildAllowed: () => true,
      nativePushQaRoleAllowed: () => true,
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => nativeAdmin.client,
    },
    "@/lib/supabase/server": {
      createClient: async () => nativeClaimsClient.client,
    },
    "next/server": { NextResponse },
  },
);

function newNativeAdmin() {
  return createClientDouble({
    claims: null,
    execute(query) {
      if (
        query.table === "profiles" &&
        query.operation === "select" &&
        query.terminal === "maybeSingle"
      ) {
        return { data: { id: actorId, role: "owner" }, error: null };
      }

      if (
        query.table === "native_push_devices" &&
        query.operation === "select"
      ) {
        return { data: [{ id: "device-row" }], error: null };
      }

      return { data: null, error: null };
    },
  });
}

const priorNativeEnvironment = {
  delivery: process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED,
  registration: process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED,
};
process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED = "true";
process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED = "true";

try {
  nativeAdmin = newNativeAdmin();
  const registration = await nativeRoute.POST(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        appBuild: "6",
        appVersion: "1.0.5",
        installationId,
        platform: "android",
        profile_id: otherId,
        token: "a".repeat(32),
        userId: otherId,
      }),
      method: "POST",
    }),
  );
  assert.equal(registration.status, 200);
  const registrationWrite = nativeAdmin.queries.find(
    (query) =>
      query.table === "native_push_devices" && query.operation === "upsert",
  );
  assert.ok(registrationWrite, "native registration must write one device row");
  assert.equal(registrationWrite.payload.profile_id, actorId);
  assert.equal("userId" in registrationWrite.payload, false);
  assert.equal("profile_id" in registrationWrite.payload, true);
  assert.equal(registrationWrite.payload.profile_id, actorId);

  nativeAdmin = newNativeAdmin();
  const suffixedInstallation = await nativeRoute.POST(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        appBuild: "6",
        appVersion: "1.0.5",
        installationId: `${installationId}attacker-suffix`,
        platform: "android",
        token: "b".repeat(32),
      }),
      method: "POST",
    }),
  );
  assert.equal(
    suffixedInstallation.status,
    400,
    "an overlong installation ID must be rejected instead of truncated to a valid UUID",
  );
  assert.equal(
    nativeAdmin.queries.some((query) => query.operation === "upsert"),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const whitespaceInstallation = await nativeRoute.POST(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        appBuild: "6",
        appVersion: "1.0.5",
        installationId: `${installationId} `,
        platform: "android",
        token: "b".repeat(32),
      }),
      method: "POST",
    }),
  );
  assert.equal(
    whitespaceInstallation.status,
    400,
    "an installation ID with normalization-only whitespace must be rejected",
  );
  assert.equal(
    nativeAdmin.queries.some((query) => query.operation === "upsert"),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const registrationStatus = await nativeRoute.GET(
    new Request(
      `https://thetattoocore.com/api/push/devices?platform=android&installationId=${installationId}`,
    ),
  );
  assert.equal(registrationStatus.status, 200);
  const statusQuery = nativeAdmin.queries.find(
    (query) =>
      query.table === "native_push_devices" && query.operation === "select",
  );
  assert.ok(statusQuery);
  assertFilter(statusQuery, "profile_id", "eq", actorId);
  assertFilter(statusQuery, "installation_id", "eq", installationId);

  nativeAdmin = newNativeAdmin();
  const suffixedStatus = await nativeRoute.GET(
    new Request(
      `https://thetattoocore.com/api/push/devices?platform=android&installationId=${installationId}attacker-suffix`,
    ),
  );
  assert.equal(suffixedStatus.status, 400);
  assert.equal(
    nativeAdmin.queries.some(
      (query) =>
        query.table === "native_push_devices" && query.operation === "select",
    ),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const whitespaceStatus = await nativeRoute.GET(
    new Request(
      `https://thetattoocore.com/api/push/devices?platform=android&installationId=${encodeURIComponent(`${installationId} `)}`,
    ),
  );
  assert.equal(whitespaceStatus.status, 400);
  assert.equal(
    nativeAdmin.queries.some(
      (query) =>
        query.table === "native_push_devices" && query.operation === "select",
    ),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const oversizedToken = await nativeRoute.POST(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        appBuild: "6",
        appVersion: "1.0.5",
        installationId,
        platform: "android",
        token: "c".repeat(4097),
      }),
      method: "POST",
    }),
  );
  assert.equal(
    oversizedToken.status,
    400,
    "an overlong native token must be rejected instead of truncated",
  );

  for (const [label, token] of [
    ["trailing whitespace", `${"d".repeat(32)} `],
    ["control character", `${"e".repeat(31)}\u0000`],
  ]) {
    nativeAdmin = newNativeAdmin();
    const invalidToken = await nativeRoute.POST(
      new Request("https://thetattoocore.com/api/push/devices", {
        body: JSON.stringify({
          appBuild: "6",
          appVersion: "1.0.5",
          installationId,
          platform: "android",
          token,
        }),
        method: "POST",
      }),
    );
    assert.equal(invalidToken.status, 400, `${label} token must be rejected`);
    assert.equal(
      nativeAdmin.queries.some((query) => query.operation === "upsert"),
      false,
    );
  }

  nativeAdmin = newNativeAdmin();
  let oversizedStreamCancelled = false;
  const oversizedStream = new ReadableStream(
    {
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(12_001)));
      },
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("must-not-buffer"));
        controller.close();
      },
      cancel() {
        oversizedStreamCancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const streamedOversize = await nativeRoute.POST(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: oversizedStream,
      duplex: "half",
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(streamedOversize.status, 400);
  assert.equal(
    oversizedStreamCancelled,
    true,
    "an oversized unknown-length native payload must cancel its stream at the byte limit",
  );
  assert.equal(
    nativeAdmin.queries.some((query) => query.operation === "upsert"),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const deletion = await nativeRoute.DELETE(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        installationId,
        platform: "android",
        profile_id: otherId,
      }),
      method: "DELETE",
    }),
  );
  assert.equal(deletion.status, 200);
  const deletionQuery = nativeAdmin.queries.find(
    (query) =>
      query.table === "native_push_devices" && query.operation === "delete",
  );
  assert.ok(deletionQuery);
  assertFilter(deletionQuery, "profile_id", "eq", actorId);
  assertFilter(deletionQuery, "installation_id", "eq", installationId);

  nativeAdmin = newNativeAdmin();
  const suffixedDeletion = await nativeRoute.DELETE(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        installationId: `${installationId}attacker-suffix`,
        platform: "android",
      }),
      method: "DELETE",
    }),
  );
  assert.equal(suffixedDeletion.status, 400);
  assert.equal(
    nativeAdmin.queries.some(
      (query) =>
        query.table === "native_push_devices" && query.operation === "delete",
    ),
    false,
  );

  nativeAdmin = newNativeAdmin();
  const whitespaceDeletion = await nativeRoute.DELETE(
    new Request("https://thetattoocore.com/api/push/devices", {
      body: JSON.stringify({
        installationId: `${installationId} `,
        platform: "android",
      }),
      method: "DELETE",
    }),
  );
  assert.equal(whitespaceDeletion.status, 400);
  assert.equal(
    nativeAdmin.queries.some(
      (query) =>
        query.table === "native_push_devices" && query.operation === "delete",
    ),
    false,
  );
} finally {
  if (priorNativeEnvironment.delivery === undefined) {
    delete process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED;
  } else {
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED =
      priorNativeEnvironment.delivery;
  }
  if (priorNativeEnvironment.registration === undefined) {
    delete process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED;
  } else {
    process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED =
      priorNativeEnvironment.registration;
  }
}

console.log("PASS native device registration rejects account substitution and opaque-ID normalization");

console.log(
  "USER INPUT SECURITY REVIEW: PASS native device payloads are byte-bounded and opaque identifiers fail closed",
);
