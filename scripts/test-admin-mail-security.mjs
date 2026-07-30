import assert from "node:assert/strict";
import {
  createSupabaseDouble,
  importTypeScriptWithStubs,
  testIds,
} from "./admin-module-test-harness.mjs";

const mailSettings = {
  from_email: "noreply@example.com",
  from_name: "TheTattooCore",
  is_enabled: true,
  reply_to_email: "support@example.com",
  smtp_host: "smtp.example.com",
  smtp_password_secret_name: "HOSTGATOR_SMTP_PASSWORD",
  smtp_port: 465,
  smtp_secure: true,
  smtp_username: "mailer@example.com",
};
const providerCalls = [];
const capturedLogs = [];
let currentClient;
let currentRateLimit = {
  limited: false,
  remaining: 4,
  resetAt: Date.now() + 60_000,
};
let providerFailure = null;

const route = await importTypeScriptWithStubs(
  "src/app/api/admin/mail/test/route.ts",
  {
    "@/lib/http/reliability": {
      checkRateLimit() {
        return currentRateLimit;
      },
    },
    "@/lib/mail/hostgator": {
      async sendHostgatorTestEmail(input) {
        providerCalls.push(input);
        if (providerFailure) throw providerFailure;
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        return currentClient;
      },
    },
    "next/server": {
      NextResponse: {
        json(value, init = {}) {
          return Response.json(value, init);
        },
      },
    },
  },
  {
    console: {
      error(...args) {
        capturedLogs.push(args.map(String).join(" "));
      },
      log(...args) {
        capturedLogs.push(args.map(String).join(" "));
      },
      warn(...args) {
        capturedLogs.push(args.map(String).join(" "));
      },
    },
  },
);

function clientForRole(role) {
  return createSupabaseDouble({
    claims:
      role === "anonymous"
        ? null
        : {
            email: `${role}@example.com`,
            sub: testIds.actor,
          },
    execute(query) {
      if (query.table === "profiles") {
        return {
          data: { role },
          error: null,
        };
      }

      if (query.table === "mail_settings") {
        return {
          data: mailSettings,
          error: null,
        };
      }

      throw new Error(`Unexpected mail test query on ${query.table}`);
    },
  });
}

function assertPrivateResponse(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  assert.match(cacheControl, /private/i);
  assert.match(cacheControl, /no-store/i);
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}

async function runRequest({
  body = JSON.stringify({ recipientEmail: "recipient@example.com" }),
  contentType = "application/json",
  origin = "https://thetattoocore.com",
  rateLimit = {
    limited: false,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  },
  role = "admin",
} = {}) {
  const roleClient = clientForRole(role);
  currentClient = roleClient.client;
  providerCalls.length = 0;
  capturedLogs.length = 0;
  currentRateLimit = rateLimit;
  providerFailure = null;
  const headers = new Headers();

  if (contentType !== null) headers.set("content-type", contentType);
  if (origin !== null) headers.set("origin", origin);

  const response = await route.POST(
    new Request("https://thetattoocore.com/api/admin/mail/test", {
      body,
      headers,
      method: "POST",
    }),
  );
  const payload = await response.json();
  assertPrivateResponse(response);

  return {
    capturedLogs: [...capturedLogs],
    payload,
    providerCalls: [...providerCalls],
    queries: roleClient.queries,
    response,
  };
}

for (const [role, expectedStatus] of [
  ["anonymous", 401],
  ["user", 403],
  ["moderator", 403],
]) {
  const result = await runRequest({ role });
  assert.equal(result.response.status, expectedStatus);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS anonymous, user, and moderator cannot invoke the mail provider");

for (const role of ["admin", "owner"]) {
  const result = await runRequest({ role });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload, { ok: true });
  assert.equal(result.providerCalls.length, 1);
  assert.equal(result.providerCalls[0].recipientEmail, "recipient@example.com");
}
console.log("PASS admin and owner can invoke the stubbed mail provider");

{
  const result = await runRequest({
    contentType: "text/plain",
  });
  assert.equal(result.response.status, 415);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail test rejects unsupported content types before provider access");

for (const body of ["{", "[]", "null"]) {
  const result = await runRequest({ body });
  assert.equal(result.response.status, 400);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail test rejects malformed JSON and non-object bodies");

{
  const result = await runRequest({
    body: JSON.stringify({
      padding: "x".repeat(5000),
      recipientEmail: "recipient@example.com",
    }),
  });
  assert.equal(result.response.status, 413);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail test bounds request bodies before provider access");

for (const body of [
  {
    recipientEmail: "recipient@example.com\r\nBcc: attacker@example.com",
  },
  {
    recipientEmail: "recipient@example.com",
    subject: "Test\r\nBcc: attacker@example.com",
  },
  {
    recipientEmail: "recipient@example.com",
    template: "<script>alert(1)</script>",
  },
  {
    recipientEmail: `${"a".repeat(250)}@example.com`,
  },
]) {
  const result = await runRequest({ body: JSON.stringify(body) });
  assert.equal(result.response.status, 400);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail recipient, template, size, and CRLF inputs are allowlisted");

for (const origin of [null, "https://attacker.example"]) {
  const result = await runRequest({ origin });
  assert.equal(result.response.status, 403);
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail test rejects missing and cross-origin POST origins");

{
  const result = await runRequest({
    rateLimit: {
      limited: true,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    },
  });
  assert.equal(result.response.status, 429);
  assert.equal(result.response.headers.get("retry-after"), "60");
  assert.equal(result.providerCalls.length, 0);
}
console.log("PASS mail test rate-limits provider invocation per authenticated actor");

{
  const providerSecret = "provider-private-response";
  currentRateLimit = {
    limited: false,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  };
  currentClient = clientForRole("owner").client;
  providerCalls.length = 0;
  capturedLogs.length = 0;
  providerFailure = new Error(providerSecret);
  const response = await route.POST(
    new Request("https://thetattoocore.com/api/admin/mail/test", {
      body: JSON.stringify({ recipientEmail: "recipient@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: "https://thetattoocore.com",
      },
      method: "POST",
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(payload, { error: "Could not send the test email." });
  assert.equal(JSON.stringify(payload).includes(providerSecret), false);
  assert.equal(capturedLogs.join("\n").includes(providerSecret), false);
  assertPrivateResponse(response);
}
console.log("PASS mail provider failures are generic and redact provider details");

assert.equal(route.GET, undefined);
console.log("PASS the mail mutation is not exposed through GET");


{
  const mailHelper = await importTypeScriptWithStubs(
    "src/lib/mail/hostgator.ts",
    {
      "server-only": {},
    },
  );
  const validated = mailHelper.validateMailSettings(mailSettings);

  assert.equal(
    validated.smtp_password_secret_name,
    "HOSTGATOR_SMTP_PASSWORD",
  );

  for (const unsafeSettings of [
    {
      ...mailSettings,
      smtp_password_secret_name: "SUPABASE_SERVICE_ROLE_KEY",
    },
    {
      ...mailSettings,
      from_name: "TheTattooCore\r\nBcc: attacker@example.com",
    },
    {
      ...mailSettings,
      from_email: "sender@example.com\r\nBcc: attacker@example.com",
    },
    {
      ...mailSettings,
      reply_to_email: "support@example.com\r\nBcc: attacker@example.com",
    },
    {
      ...mailSettings,
      smtp_host: "smtp.example.com\r\nattacker.example",
    },
    {
      ...mailSettings,
      smtp_username: "mailer@example.com\r\nattacker",
    },
  ]) {
    assert.throws(() => mailHelper.validateMailSettings(unsafeSettings));
  }
}
console.log(
  "PASS mail transport pins its password binding and rejects configured header injection",
);
