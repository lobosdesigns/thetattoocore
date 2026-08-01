import assert from "node:assert/strict";
import { importTypeScriptWithStubs } from "./admin-module-test-harness.mjs";

let signOutOptions;

const route = await importTypeScriptWithStubs(
  "src/app/auth/signout/route.ts",
  {
    "@/lib/device-alert-cookies": {
      deviceAlertCookieOptions: { path: "/" },
      nativePushDeviceCookie: "ttc-native-device",
      parseNativePushCookie: () => null,
      validDeviceAlertUuid: () => false,
      webPushSubscriptionCookie: "ttc-web-device",
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => null,
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getClaims: async () => ({ data: { claims: {} } }),
          signOut: async (options) => {
            signOutOptions = options;
            return { error: null };
          },
        },
      }),
    },
    "next/cache": {
      revalidatePath: () => undefined,
    },
    "next/server": {
      NextResponse: {
        redirect(url, { status }) {
          const response = new Response(null, {
            headers: { location: String(url) },
            status,
          });
          response.cookies = { set: () => undefined };
          return response;
        },
      },
    },
  },
  { console: { error: () => undefined, log: () => undefined } },
);

const request = new Request("https://thetattoocore.com/auth/signout", {
  method: "POST",
});
request.cookies = { get: () => undefined };

const response = await route.POST(request);

assert.equal(response.status, 302);
assert.equal(signOutOptions?.scope, "local");
assert.deepEqual(Object.keys(signOutOptions ?? {}), ["scope"]);

console.log("PASS browser sign-out keeps other app and browser sessions active");
