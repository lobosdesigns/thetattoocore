import { readFileSync } from "node:fs";

const searchPage = readFileSync("src/app/search/page.tsx", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const requiredPublicContentFilters = [
  '.eq("is_published", true)',
  '.eq("moderation_status", "active")',
  '.eq("visibility", "public_preview")',
  '.eq("is_sensitive", false)',
  '.eq("status", "active")',
  '.eq("is_indexable", true)',
];

for (const filter of requiredPublicContentFilters) {
  assert(searchPage.includes(filter), `search keeps public visibility filter ${filter}`);
}

assert(searchPage.includes("const SEARCH_RESULT_TYPES"), "search result type values are centralized");
assert(searchPage.includes("const PROFILE_CATEGORY_VALUES"), "profile category filters are explicit");
assert(searchPage.includes('publicProfileQuery = publicProfileQuery.in("account_type", profileCategories)'), "profile category filters use enum equality");
assert(searchPage.includes("const SEARCH_SORT_VALUES"), "search sort values are explicit");
assert(searchPage.includes("cleanSort(params.sort)"), "search sanitizes sort query parameters");
assert(searchPage.includes('<option value="recent">Recent</option>'), "search exposes stable recent sort query-string control");
assert(searchPage.includes("style"), "search supports style query-string filtering");
assert(searchPage.includes('name="category"') && searchPage.includes('name="type"') && searchPage.includes('name="sort"'), "search has category/type/sort controls");
assert(searchPage.includes("SearchLoadingState"), "search has an accessible loading state");
assert(searchPage.includes("style_tags"), "search includes tattoo style tags in public post matching");
assert(searchPage.includes("{ value: post.style_tags, weight: 24 }"), "style tags contribute to post ranking");
assert(searchPage.includes("profile.account_type === \"artist\""), "artist result category is distinguished");
assert(searchPage.includes("profile.account_type === \"studio\""), "studio result category is distinguished");
assert(searchPage.includes("ThreadResult"), "Gossip results remain supported");
assert(searchPage.includes("GigResult"), "Gig results remain supported");
assert(searchPage.includes("MerchResult"), "Merch results remain supported");
assert(searchPage.includes("page = Math.max(1, Math.min(20"), "malformed or extreme page parameters are constrained");
assert(searchPage.includes("resultLimit = page * 25"), "pagination remains capped and deterministic");
assert(searchPage.includes("total} result"), "accurate rendered result count is preserved");
assert(searchPage.includes("No matches yet"), "empty state is preserved");

if (process.exitCode) process.exit(process.exitCode);
console.log("All search discovery contract checks passed.");
