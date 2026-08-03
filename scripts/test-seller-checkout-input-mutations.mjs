import { spawnSync } from "node:child_process";

const testArgs = [
  "--no-warnings",
  "--experimental-vm-modules",
  "scripts/test-seller-checkout-links.mjs",
];
const mutationCases = [
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "seller acceptance accepted a value other than exact on",
    name: "acceptance-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "category allowlist accepted a File-valued seller enum",
    name: "category-allowlist-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "forged seller ID reached the parameterized insert",
    name: "forged-seller-id",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "inventory overflow must stay capped",
    name: "inventory-cap-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "non-finite or malformed inventory reached the product insert",
    name: "inventory-finite-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "hostile original filename reached the generated storage path",
    name: "media-original-filename-path",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "invalid media bytes bypassed real metadata validation",
    name: "media-validation-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "price overflow must stay capped",
    name: "price-cap-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "non-finite or malformed price reached the product insert",
    name: "price-finite-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "unsafe edit return target escaped the fixed product fallback",
    name: "return-path-control-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "shipping toggle accepted a value other than exact on",
    name: "shipping-boolean-bypass",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "title must remain bounded to 120 characters",
    name: "unbounded-create-title",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "forged product ID escaped exact parameter filtering",
    name: "unscoped-edit-lookup",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "zero-row trusted create was treated as seller checkout success",
    name: "zero-row-create-success",
  },
  {
    env: "TTC_SELLER_CHECKOUT_ACTION_MUTANT",
    expected: "zero-row trusted edit was treated as Merch update success",
    name: "zero-row-edit-success",
  },
  {
    env: "TTC_SELLER_CHECKOUT_TASK4_MUTANT",
    expected: "hostile listing markup became active HTML",
    name: "unsafe-product-title-html",
  },
  {
    env: "TTC_SELLER_CHECKOUT_TASK4_MUTANT",
    expected: "hostile seller name was not rendered three times as escaped React text",
    name: "unsafe-seller-name-html",
  },
];

let failures = 0;
for (const mutation of mutationCases) {
  const result = spawnSync(process.execPath, testArgs, {
    encoding: "utf8",
    env: {
      ...process.env,
      [mutation.env]: mutation.name,
    },
    timeout: 180000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const killed =
    result.status === 1 &&
    output.includes(mutation.expected) &&
    !output.includes("Mutation target count changed") &&
    !output.includes("SyntaxError");

  if (killed) {
    console.log(`PASS seller input mutation killed: ${mutation.name}`);
  } else {
    failures += 1;
    console.error(`FAIL seller input mutation survived: ${mutation.name}`);
    if (result.error) console.error(result.error.message);
  }
}

if (failures > 0) {
  console.error(`${failures} seller input mutation(s) survived.`);
  process.exit(1);
}
