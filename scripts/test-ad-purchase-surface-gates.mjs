import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importSelfContainedTypeScript } from "./import-self-contained-typescript.mjs";

const {
  adPurchaseSurfaceEnabled,
  adPurchaseSurfaceFromUserAgent,
  anyAdPurchaseSurfaceEnabled,
} = await importSelfContainedTypeScript(
  "../src/lib/commerce-launch.ts",
  import.meta.url,
);

for (const [userAgent, expected] of [
  ["Mozilla/5.0 Safari/605.1.15 TTCNative/iOS", "ios"],
  ["Mozilla/5.0 Chrome/140 Mobile TTCNative/Android", "android"],
  ["Mozilla/5.0 Chrome/140", "web"],
  ["", "web"],
  [null, "web"],
  [{ toString: () => "TTCNative/iOS" }, "web"],
  ["TTCNative/iOS-lookalike", "web"],
  ["prefixTTCNative/Android", "web"],
  ["ttcnative/ios", "web"],
  ["TTCNative/Windows", "web"],
]) {
  assert.equal(adPurchaseSurfaceFromUserAgent(userAgent), expected);
}
console.log("PASS ad purchase surface accepts only exact native wrapper markers");

const gateNames = {
  android: "TTC_ANDROID_AD_PURCHASES_ENABLED",
  ios: "TTC_IOS_AD_PURCHASES_ENABLED",
  web: "TTC_WEB_AD_PURCHASES_ENABLED",
};

for (const surface of Object.keys(gateNames)) {
  const gate = gateNames[surface];

  for (const [value, expected] of [
    [undefined, false],
    ["", false],
    ["false", false],
    ["trueish", false],
    ["TRUE", false],
    [" true", false],
    ["true ", false],
    [true, false],
    [1, false],
    [{}, false],
    ["true", true],
  ]) {
    assert.equal(adPurchaseSurfaceEnabled(surface, { [gate]: value }), expected);
  }
}

for (const invalidSurface of [undefined, null, "", "windows", true, {}]) {
  assert.equal(adPurchaseSurfaceEnabled(invalidSurface, {}), false);
}
console.log("PASS each ad purchase surface requires its own exact true gate");

assert.equal(anyAdPurchaseSurfaceEnabled({}), false);
assert.equal(
  anyAdPurchaseSurfaceEnabled({ TTC_IOS_AD_PURCHASES_ENABLED: "true" }),
  true,
);
assert.equal(
  anyAdPurchaseSurfaceEnabled({ TTC_ANDROID_AD_PURCHASES_ENABLED: "TRUE" }),
  false,
);
console.log("PASS aggregate ad purchase readiness remains fail closed");

const capacitorConfig = readFileSync(
  "native/thetattoocore-mobile/capacitor.config.ts",
  "utf8",
);
const androidMainActivity = readFileSync(
  "native/thetattoocore-mobile/android/app/src/main/java/com/thetattoocore/app/MainActivity.java",
  "utf8",
);
assert.ok(capacitorConfig.includes('appendUserAgent: " TTCNative/Android"'));
assert.ok(capacitorConfig.includes('appendUserAgent: " TTCNative/iOS"'));
console.log("PASS native wrappers append exact server-visible purchase markers");

assert.ok(
  androidMainActivity.includes(
    "import com.thetattoocore.app.payments.TtcAdPurchasesPlugin;",
  ),
);
assert.ok(
  androidMainActivity.includes(
    "getBridge().registerPlugin(TtcAdPurchasesPlugin.class);",
  ),
);
console.log("PASS Android registers the app-local ad purchase bridge");

const envExample = readFileSync(".env.example", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");
for (const gate of Object.values(gateNames)) {
  assert.ok(envExample.includes(`${gate}=false`));
  assert.ok(wrangler.includes(`"${gate}": "false"`));
}
console.log("PASS all ad purchase surfaces ship disabled in documented runtime config");
