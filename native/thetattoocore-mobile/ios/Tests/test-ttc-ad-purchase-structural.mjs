import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const iosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  const absolutePath = path.join(iosRoot, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} must exist`);
  return readFileSync(absolutePath, "utf8");
}

const plugin = read("App/App/TtcAdPurchasesPlugin.swift");
const state = read("App/App/TtcAdPurchaseState.swift");
const stateTests = read("Tests/TtcAdPurchaseStateTests.swift");
const project = read("App/App.xcodeproj/project.pbxproj");

assert.match(
  plugin,
  /func clearAccount[\s\S]*getString\("profileId"\)[\s\S]*TtcRFC4122UUID\.parse\(profileID\)[\s\S]*\.clear\(profileID: profileID\)/,
  "clearAccount must validate profileId and clear only that configured profile",
);
assert.match(
  plugin,
  /completeRecovery[\s\S]*recordDelivery\([\s\S]*mode: \.explicitRecovery/,
  "explicit unfinished recovery must bypass passive delivery dedupe",
);
assert.match(
  plugin,
  /deliverTransactionUpdate[\s\S]*recordDelivery\([\s\S]*mode: \.passive/,
  "transaction updates must retain passive dedupe",
);
assert.match(
  plugin,
  /beginFinish\([\s\S]*beginStoreKitFinish\([\s\S]*transaction\.finish\(\)/,
  "finish must be serialized before the one StoreKit finish call",
);
assert.equal(
  plugin.match(/transaction\.finish\(\)/g)?.length,
  1,
  "the plugin must contain exactly one StoreKit finish call",
);
assert.match(
  plugin,
  /TtcGrantConfirmationValidator\.matches\(/,
  "server confirmation fields must be checked by the tested validator",
);
assert.doesNotMatch(plugin, /serverGrantConfirmed/);
assert.doesNotMatch(plugin, /Transaction\.currentEntitlements/);
assert.match(
  plugin,
  /https:\/\/thetattoocore\.com\/api\/ads\/purchases\/apple\/confirm/,
  "native confirmation endpoint must remain fixed",
);

for (const requiredStateMethod of [
  "enum TtcRFC4122UUID",
  "static func parse(",
  "configure(profileID:",
  "clear(profileID:",
  "recordDelivery(",
  "beginFinish(",
  "beginStoreKitFinish(",
  "failFinish(",
  "completeFinish(",
]) {
  assert.ok(
    state.includes(requiredStateMethod),
    `state machine must define ${requiredStateMethod}`,
  );
}

for (const requiredTest of [
  "testCanonicalRFC4122Validation",
  "testAccountRevisionSwitching",
  "testConditionalClearRejectsStaleCleanup",
  "testBufferingAndPassiveDeliveryDedupe",
  "testExplicitRecoveryRedeliversAfterFailure",
  "testConcurrentFinishSuppression",
  "testConfirmationMismatchFailsClosed",
  "testSuccessfulFinishTransitionsExactlyOnce",
]) {
  assert.ok(stateTests.includes(requiredTest), `${requiredTest} must be covered`);
}

assert.match(
  project,
  /TtcAdPurchaseState\.swift in Sources/,
  "the tested state machine must belong to the App target",
);

console.log("iOS StoreKit round-2 structural guards passed.");
