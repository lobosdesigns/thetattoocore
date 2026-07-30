import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

export const testIds = {
  actor: "00000000-0000-4000-8000-000000000101",
  other: "00000000-0000-4000-8000-000000000202",
  third: "00000000-0000-4000-8000-000000000303",
};

export class RedirectSignal extends Error {
  constructor(location) {
    super(`Redirected to ${location}`);
    this.location = location;
  }
}

export class AuthorizedOperationReached extends Error {
  constructor(operation = "privileged operation") {
    super(`Authorization passed before ${operation}`);
    this.operation = operation;
  }
}

export function makeForm(values) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      formData.set(key, String(value));
    }
  }

  return formData;
}

function defaultContext(consoleValue) {
  return {
    AbortController,
    Blob,
    DOMException,
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
    console: consoleValue,
    crypto,
    fetch,
    process,
    queueMicrotask,
    setInterval,
    setTimeout,
    structuredClone,
  };
}

export async function importTypeScriptWithStubs(
  relativePath,
  stubs,
  { console: consoleValue = console, globals = {} } = {},
) {
  const absolutePath = resolve(relativePath);
  const source = await readFile(absolutePath, "utf8");
  const { diagnostics = [], outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
    reportDiagnostics: true,
  });
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  if (errors.length > 0) {
    const codes = [...new Set(errors.map(({ code }) => `TS${code}`))].join(", ");
    throw new SyntaxError(`TypeScript transpilation failed: ${codes}`);
  }

  const context = vm.createContext({
    ...defaultContext(consoleValue),
    ...globals,
  });
  const moduleCache = new Map();
  const sourceModule = new vm.SourceTextModule(outputText, {
    context,
    identifier: pathToFileURL(absolutePath).href,
  });

  await sourceModule.link(async (specifier) => {
    if (moduleCache.has(specifier)) {
      return moduleCache.get(specifier);
    }

    const exports = stubs[specifier];
    if (!exports) {
      throw new Error(`Missing test stub for ${specifier}`);
    }

    const names = Object.keys(exports);
    const stubModule = new vm.SyntheticModule(
      names,
      function initializeStub() {
        for (const name of names) {
          this.setExport(name, exports[name]);
        }
      },
      {
        context,
        identifier: `stub:${specifier}`,
      },
    );
    moduleCache.set(specifier, stubModule);
    return stubModule;
  });
  await sourceModule.evaluate();

  return sourceModule.namespace;
}

function canModerateUserStatus(actorRole, targetRole) {
  const roleRank = {
    admin: 2,
    moderator: 1,
    owner: 3,
    user: 0,
  };

  return (
    actorRole !== "user" &&
    targetRole !== "owner" &&
    roleRank[actorRole] > roleRank[targetRole]
  );
}

function isAssignableUserRole(role) {
  return ["user", "moderator", "admin"].includes(role);
}

export async function loadAdminActions({
  console: consoleValue = console,
  createAdminClient = () => null,
  createClient,
  createStripeClient = () => null,
  insertNotifications = async () => ({ error: null }),
  sendHostgatorEmail = async () => {},
  stripeCheckoutPreflight = () => ({ actual: false, ready: false }),
} = {}) {
  if (!createClient) {
    throw new TypeError("createClient is required");
  }

  const revalidatedPaths = [];
  const actions = await importTypeScriptWithStubs(
    "src/app/admin/actions.ts",
    {
      "@/lib/admin-role-hierarchy": {
        canModerateUserStatus,
        isAssignableUserRole,
      },
      "@/lib/mail/hostgator": {
        sendHostgatorEmail,
      },
      "@/lib/notification-write": {
        insertNotifications,
      },
      "@/lib/site": {
        siteName: "TheTattooCore",
        siteUrl: "https://thetattoocore.com",
        supportEmail: "support@example.com",
      },
      "@/lib/stripe/checkout-session": {
        bookingCheckoutReconciliationDecision: () => ({
          action: "hold",
          reason: "test",
        }),
        bookingCheckoutReleaseAttemptDecision: () => ({
          action: "reject",
          reason: "test",
        }),
      },
      "@/lib/stripe/server": {
        createStripeClient,
        stripeCheckoutPreflight,
      },
      "@/lib/supabase/admin": {
        createAdminClient,
      },
      "@/lib/supabase/server": {
        createClient,
      },
      "next/cache": {
        revalidatePath(path) {
          revalidatedPaths.push(path);
        },
      },
      "next/navigation": {
        redirect(location) {
          throw new RedirectSignal(String(location));
        },
      },
    },
    { console: consoleValue },
  );

  return { actions, revalidatedPaths };
}

class QueryDouble {
  constructor(table, execute) {
    this.execute = execute;
    this.state = {
      filters: [],
      operation: null,
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

  insert(payload) {
    this.state.operation = "insert";
    this.state.payload = payload;
    return this;
  }

  is(column, value) {
    this.state.filters.push({ column, operator: "is", value });
    return this;
  }

  limit(value) {
    this.state.limit = value;
    return this;
  }

  maybeSingle() {
    return this.run("maybeSingle");
  }

  order() {
    return this;
  }

  range() {
    return this;
  }

  returns() {
    return this.run("returns");
  }

  select(selection, options) {
    this.state.operation ??= "select";
    this.state.selection = selection;
    this.state.selectOptions = options;
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

export function createSupabaseDouble({
  claims,
  execute,
  rpc = async (name, payload) =>
    execute({
      filters: [],
      operation: "rpc",
      payload,
      table: name,
      terminal: "await",
    }),
}) {
  const queries = [];
  const client = {
    auth: {
      async getClaims() {
        return {
          data: claims ? { claims } : null,
          error: null,
        };
      },
    },
    from(table) {
      return new QueryDouble(table, async (query) => {
        queries.push(query);
        return execute(query);
      });
    },
    rpc,
  };

  return { client, queries };
}

export function createRoleBoundaryClient(role, actorId = testIds.actor) {
  return createSupabaseDouble({
    claims:
      role === "anonymous"
        ? null
        : {
            email: `${role}@example.com`,
            sub: actorId,
          },
    execute(query) {
      const actorLookup =
        query.table === "profiles" &&
        query.operation === "select" &&
        query.filters.some(
          (filter) =>
            filter.column === "id" &&
            filter.operator === "eq" &&
            filter.value === actorId,
        );

      if (actorLookup) {
        return {
          data: { role },
          error: null,
        };
      }

      throw new AuthorizedOperationReached(
        `${query.operation ?? "query"} on ${query.table}`,
      );
    },
  });
}
