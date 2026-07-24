import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const requireRuntime = process.argv.includes("--require-runtime");
const requireDevice = process.argv.includes("--require-device") || requireRuntime;
const inspectRuntime = process.argv.includes("--inspect-runtime") || requireRuntime;
const openTestJoin = process.argv.includes("--open-test-join");
const openAppLink = process.argv.includes("--open-app-link");
const androidPackageName = "com.thetattoocore.app";
const closedTestJoinUrl = `https://play.google.com/apps/testing/${androidPackageName}`;
const playStoreUrl = `https://play.google.com/store/apps/details?id=${androidPackageName}`;
const appLinkUrl = "https://thetattoocore.com/messages";
const androidBuildGradlePath = "native/thetattoocore-mobile/android/app/build.gradle";
const androidVariablesGradlePath = "native/thetattoocore-mobile/android/variables.gradle";
const waitMsArg = process.argv.find((arg) => arg.startsWith("--wait-ms="));
const waitMs = Math.max(
  0,
  Math.min(120_000, Number.parseInt(waitMsArg?.split("=")[1] ?? "0", 10) || 0),
);
const pollIntervalMs = 1000;

function candidateAdbPaths() {
  const paths = [];

  if (process.env.ADB_PATH) paths.push(process.env.ADB_PATH);
  if (process.env.ANDROID_HOME) {
    paths.push(join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"));
    paths.push(join(process.env.ANDROID_HOME, "platform-tools", "adb"));
  }
  if (process.env.ANDROID_SDK_ROOT) {
    paths.push(join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe"));
    paths.push(join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb"));
  }
  if (process.env.LOCALAPPDATA) {
    paths.push(join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe"));
  }

  paths.push("adb");

  return [...new Set(paths)];
}

function findAdb() {
  for (const candidate of candidateAdbPaths()) {
    if (candidate === "adb" || existsSync(candidate)) return candidate;
  }

  return "";
}

function runAdb(adb, args) {
  return execFileSync(adb, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function openClosedTestJoin(adb, serial) {
  try {
    runAdb(adb, [
      "-s",
      serial,
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      closedTestJoinUrl,
    ]);
    console.log("ANDROID_QA closed_test_join=open requested");
  } catch {
    console.log("ANDROID_QA closed_test_join=open failed");
  }
}

function androidAppLinkState(output) {
  const domains = ["thetattoocore.com", "www.thetattoocore.com"];
  const verified = domains.every((domain) =>
    new RegExp(`^\\s*${domain}: verified\\s*$`, "m").test(output),
  );
  const enabledBlock = output.match(/Selection state:\s+Enabled:\s+([\s\S]*?)(?:\n\s+\w[^:\n]*:|$)/)?.[1] ?? "";
  const enabled = domains.every((domain) =>
    new RegExp(`^\\s*${domain}\\s*$`, "m").test(enabledBlock),
  );

  return { enabled, verified };
}

function openVerifiedAppLink(adb, serial) {
  try {
    const output = runAdb(adb, [
      "-s",
      serial,
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      appLinkUrl,
    ]);
    const openedProductionApp = output.includes(`${androidPackageName}/.MainActivity`);
    console.log(
      `ANDROID_QA app_link_open=${openedProductionApp ? "production app" : "not confirmed"}`,
    );
    return openedProductionApp;
  } catch {
    console.log("ANDROID_QA app_link_open=failed");
    return false;
  }
}

function expectedAndroidBuild() {
  const buildGradle = existsSync(androidBuildGradlePath)
    ? readFileSync(androidBuildGradlePath, "utf8")
    : "";
  const versionName =
    process.env.TTC_ANDROID_EXPECTED_VERSION_NAME ||
    buildGradle.match(/versionName\s+"([^"]+)"/)?.[1] ||
    "";
  const versionCode =
    process.env.TTC_ANDROID_EXPECTED_VERSION_CODE ||
    buildGradle.match(/versionCode\s+(\d+)/)?.[1] ||
    "";
  const variablesGradle = existsSync(androidVariablesGradlePath)
    ? readFileSync(androidVariablesGradlePath, "utf8")
    : "";
  const targetSdk =
    process.env.TTC_ANDROID_EXPECTED_TARGET_SDK ||
    variablesGradle.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1] ||
    "";

  return { targetSdk, versionCode, versionName };
}

function installedAndroidBuild(packageDump) {
  return {
    targetSdk: packageDump.match(/targetSdk=(\d+)/)?.[1] || "",
    versionCode: packageDump.match(/versionCode=(\d+)/)?.[1] || "",
    versionName: packageDump.match(/versionName=([^\s]+)/)?.[1] || "",
  };
}

function runtimeFatalErrorCount(logOutput) {
  const fatalSignals = [
    /\bFATAL EXCEPTION\b/i,
    /\bAndroidRuntime\b/i,
    /\bchromium\b.*\b(?:CONSOLE|Uncaught|net::ERR_)\b/i,
  ];

  return fatalSignals.filter((pattern) => pattern.test(logOutput)).length;
}

function inspectAndroidRuntime(shell) {
  let pid = "";

  try {
    pid = shell(["pidof", androidPackageName]).split(/\s+/)[0] || "";
  } catch {
    // A stopped app is a valid state for the optional probe.
  }

  if (!/^\d+$/.test(pid)) {
    return {
      fatalErrorCount: null,
      focus: "unknown",
      logReview: "unavailable",
      process: "not running",
    };
  }

  let fatalErrorCount = null;
  let logReview = "unavailable";

  try {
    const logOutput = shell([
      "logcat",
      "-d",
      `--pid=${pid}`,
      "-t",
      "400",
      "*:E",
    ]);
    fatalErrorCount = runtimeFatalErrorCount(logOutput);
    logReview = "available";
  } catch {
    // Keep raw device logs private and report only whether review was possible.
  }

  let focus = "unknown";

  try {
    const focusLines = shell(["dumpsys", "window"])
      .split(/\r?\n/)
      .filter((line) =>
        /\b(?:mCurrentFocus|mFocusedApp|topResumedActivity|mResumedActivity)\b/.test(
          line,
        ),
      );
    focus = focusLines.some((line) => line.includes(androidPackageName))
      ? "production app"
      : focusLines.length > 0
        ? "not focused"
        : "unknown";
  } catch {
    // Focus is useful context but is not required for background runtime health.
  }

  return {
    fatalErrorCount,
    focus,
    logReview,
    process: "running",
  };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial = "", state = ""] = line.split(/\s+/, 2);
      return { serial, state };
    });
}

const adb = findAdb();

if (!adb) {
  console.log("ANDROID_QA adb=missing");
  console.log("ANDROID_QA result=automation unavailable");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

let devices = [];

try {
  runAdb(adb, ["start-server"]);
  console.log("ANDROID_QA adb_server=started");
} catch {
  console.log("ANDROID_QA adb_server=start failed");
}

try {
  const deadline = Date.now() + waitMs;

  if (waitMs > 0) {
    console.log(`ANDROID_QA wait_ms=${waitMs}`);
  }

  do {
    devices = parseDevices(runAdb(adb, ["devices", "-l"]));

    if (devices.some((device) => device.state === "device") || Date.now() >= deadline) {
      break;
    }

    sleep(pollIntervalMs);
  } while (true);
} catch (error) {
  console.log("ANDROID_QA adb=error");
  console.log("ANDROID_QA result=automation unavailable");
  console.log(`ANDROID_QA detail=${error instanceof Error ? error.message : "unknown adb error"}`);
  if (requireDevice) process.exit(1);
  process.exit(0);
}

const authorizedDevices = devices.filter((device) => device.state === "device");
const blockedDevices = devices.filter((device) => device.state !== "device");

console.log(`ANDROID_QA adb=${adb === "adb" ? "PATH" : adb}`);
console.log(`ANDROID_QA devices_total=${devices.length}`);
console.log(`ANDROID_QA devices_authorized=${authorizedDevices.length}`);
if (blockedDevices.length > 0) {
  console.log(`ANDROID_QA devices_blocked_states=${[...new Set(blockedDevices.map((device) => device.state))].join(",")}`);
  console.log("ANDROID_QA next=unlock device, enable USB debugging, and accept the computer authorization prompt");
}

if (authorizedDevices.length === 0) {
  console.log("ANDROID_QA result=no authorized device");
  console.log("ANDROID_QA handoff=manual evidence only until an authorized device appears");
  if (devices.length === 0) {
    console.log("ANDROID_QA next=check USB cable, set USB mode to file transfer, and reopen the USB debugging prompt");
    console.log("ANDROID_QA next_detail=record Android automation not yet available in the private handoff if manual testing continues first");
  }
  if (requireDevice) process.exit(1);
  process.exit(0);
}

const primary = authorizedDevices[0];
const shell = (args) => runAdb(adb, ["-s", primary.serial, "shell", ...args]);
const expectedBuild = expectedAndroidBuild();

if (openTestJoin) {
  openClosedTestJoin(adb, primary.serial);
}

let model = "unknown";
let osVersion = "unknown";
let packageSummary = "not installed";
let packageInstalled = false;
let installedBuild = { targetSdk: "", versionCode: "", versionName: "" };

try {
  model = shell(["getprop", "ro.product.model"]);
  osVersion = shell(["getprop", "ro.build.version.release"]);
} catch {
  // Keep the output repo-safe and continue to package check.
}

try {
  const packageDump = shell(["dumpsys", "package", androidPackageName]);
  installedBuild = installedAndroidBuild(packageDump);
  const versionLines = packageDump
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("versionName=") || line.startsWith("versionCode="));
  packageSummary = versionLines.join("; ") || "installed, version not found";
  packageInstalled = true;
} catch {
  packageSummary = "not installed";
}

console.log(`ANDROID_QA device_model=${model || "unknown"}`);
console.log(`ANDROID_QA android_version=${osVersion || "unknown"}`);
console.log(
  `ANDROID_QA expected_versionName=${expectedBuild.versionName || "unknown"}`,
);
console.log(
  `ANDROID_QA expected_versionCode=${expectedBuild.versionCode || "unknown"}`,
);
console.log(`ANDROID_QA expected_targetSdk=${expectedBuild.targetSdk || "unknown"}`);
console.log(`ANDROID_QA package=${packageSummary}`);

if (!packageInstalled) {
  console.log("ANDROID_QA result=authorized device missing TTC package");
  console.log(`ANDROID_QA closed_test_join_url=${closedTestJoinUrl}`);
  console.log(`ANDROID_QA play_store_url=${playStoreUrl}`);
  console.log("ANDROID_QA next=join the active Google Play closed test, install its exact build, and rerun route QA");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

const versionNameMatches =
  !expectedBuild.versionName ||
  installedBuild.versionName === expectedBuild.versionName;
const versionCodeMatches =
  !expectedBuild.versionCode ||
  installedBuild.versionCode === expectedBuild.versionCode;
const targetSdkMatches =
  !expectedBuild.targetSdk || installedBuild.targetSdk === expectedBuild.targetSdk;

if (!versionNameMatches || !versionCodeMatches || !targetSdkMatches) {
  console.log("ANDROID_QA result=authorized device has wrong TTC build");
  console.log(
    `ANDROID_QA installed_versionName=${installedBuild.versionName || "unknown"}`,
  );
  console.log(
    `ANDROID_QA installed_versionCode=${installedBuild.versionCode || "unknown"}`,
  );
  console.log(
    `ANDROID_QA installed_targetSdk=${installedBuild.targetSdk || "unknown"}`,
  );
  console.log(`ANDROID_QA closed_test_join_url=${closedTestJoinUrl}`);
  console.log(`ANDROID_QA play_store_url=${playStoreUrl}`);
  console.log("ANDROID_QA next=join the active Google Play closed test and install its exact build, or set TTC_ANDROID_EXPECTED_VERSION_NAME and TTC_ANDROID_EXPECTED_VERSION_CODE for the selected track");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

let appLinkState = { enabled: false, verified: false };

try {
  appLinkState = androidAppLinkState(
    shell(["pm", "get-app-links", "--user", "cur", androidPackageName]),
  );
} catch {
  // Keep the device probe useful on Android versions without app-link diagnostics.
}

console.log(
  `ANDROID_QA app_link_domains=${appLinkState.verified ? "verified" : "not verified"}`,
);
console.log(
  `ANDROID_QA app_link_selection=${appLinkState.enabled ? "enabled" : "not enabled"}`,
);

if (openAppLink && appLinkState.verified && appLinkState.enabled) {
  openVerifiedAppLink(adb, primary.serial);
} else if (openAppLink) {
  console.log("ANDROID_QA app_link_open=skipped until verified and enabled");
}

if (requireDevice && (!appLinkState.verified || !appLinkState.enabled)) {
  console.log("ANDROID_QA result=verified app links are not ready");
  process.exit(1);
}

if (inspectRuntime) {
  const runtime = inspectAndroidRuntime(shell);

  console.log(`ANDROID_QA runtime_process=${runtime.process}`);
  console.log(`ANDROID_QA runtime_log_review=${runtime.logReview}`);
  console.log(
    `ANDROID_QA runtime_fatal_errors=${runtime.fatalErrorCount ?? "unknown"}`,
  );
  console.log(`ANDROID_QA runtime_focus=${runtime.focus}`);

  if (requireRuntime && runtime.process !== "running") {
    console.log("ANDROID_QA result=runtime process is not running");
    process.exit(1);
  }

  if (requireRuntime && runtime.logReview !== "available") {
    console.log("ANDROID_QA result=runtime log review unavailable");
    process.exit(1);
  }

  if (requireRuntime && runtime.fatalErrorCount !== 0) {
    console.log("ANDROID_QA result=runtime fatal errors detected");
    process.exit(1);
  }
}

console.log("ANDROID_QA result=authorized device ready for private route QA");
