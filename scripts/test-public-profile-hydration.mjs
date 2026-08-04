import assert from "node:assert/strict";

import {
  loadAuthenticatedProfileMap,
  loadPublicProfileMap,
} from "../src/lib/public-profile-hydration.ts";

function createSupabaseFixture() {
  const calls = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;

  const supabase = {
    from(table) {
      const call = { ids: [], table };
      const chain = {
        select() {
          return chain;
        },
        in(_column, ids) {
          call.ids = [...ids];
          return chain;
        },
        async returns() {
          calls.push(call);
          activeRequests += 1;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          await new Promise((resolve) => setImmediate(resolve));
          activeRequests -= 1;
          return {
            data: call.ids.map((id) => ({
              account_type: "artist",
              avatar_url: null,
              banner_url: null,
              city: null,
              display_name: id,
              id,
              license_verified_at: null,
              region: null,
              username: id,
            })),
          };
        },
      };
      return chain;
    },
  };

  return {
    calls,
    getMaxActiveRequests: () => maxActiveRequests,
    supabase,
  };
}

const publicFixture = createSupabaseFixture();
const uniqueIds = Array.from({ length: 205 }, (_, index) => `profile-${index}`);
const publicProfiles = await loadPublicProfileMap(
  publicFixture.supabase,
  [...uniqueIds, uniqueIds[0], null, undefined, ""],
);

assert.equal(publicProfiles.size, 205, "public hydration de-duplicates IDs and preserves every returned profile");
assert.deepEqual(
  publicFixture.calls.map(({ ids }) => ids.length),
  [100, 100, 5],
  "public hydration caps every database request at 100 profile IDs",
);
assert.deepEqual(
  publicFixture.calls.map(({ table }) => table),
  ["public_profiles", "public_profiles", "public_profiles"],
  "signed-out hydration reads only the curated public projection",
);
assert.equal(
  publicFixture.getMaxActiveRequests(),
  1,
  "public profile batches execute sequentially with one active request",
);

const authenticatedFixture = createSupabaseFixture();
await loadAuthenticatedProfileMap(authenticatedFixture.supabase, ["owner-profile"]);
assert.equal(
  authenticatedFixture.calls[0]?.table,
  "profiles",
  "authenticated owner and moderator hydration keeps its explicit base-table path",
);

console.log("All public profile hydration checks passed.");
