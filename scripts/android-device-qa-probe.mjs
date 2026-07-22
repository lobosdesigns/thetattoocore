import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const requireDevice = process.argv.includes("--require-device");
const androidBuildGradlePath = "native/thetattoocore-mobile/android/app/build.gradle";
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

  return { versionCode, versionName };
}

function installedAndroidBuild(packageDump) {
  return {
    versionCode: packageDump.match(/versionCode=(\d+)/)?.[1] || "",
    versionName: packageDump.match(/versionName=([^\s]+)/)?.[1] || "",
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

let model = "unknown";
let osVersion = "unknown";
let packageSummary = "not installed";
let packageInstalled = false;
let installedBuild = { versionCode: "", versionName: "" };

try {
  model = shell(["getprop", "ro.product.model"]);
  osVersion = shell(["getprop", "ro.build.version.release"]);
} catch {
  // Keep the output repo-safe and continue to package check.
}

try {
  const packageDump = shell(["dumpsys", "package", "com.thetattoocore.app"]);
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
console.log(`ANDROID_QA package=${packageSummary}`);

if (!packageInstalled) {
  console.log("ANDROID_QA result=authorized device missing TTC package");
  console.log("ANDROID_QA next=install or confirm the Google Play closed-testing build before route QA");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

const versionNameMatches =
  !expectedBuild.versionName ||
  installedBuild.versionName === expectedBuild.versionName;
const versionCodeMatches =
  !expectedBuild.versionCode ||
  installedBuild.versionCode === expectedBuild.versionCode;

if (!versionNameMatches || !versionCodeMatches) {
  console.log("ANDROID_QA result=authorized device has wrong TTC build");
  console.log(
    `ANDROID_QA installed_versionName=${installedBuild.versionName || "unknown"}`,
  );
  console.log(
    `ANDROID_QA installed_versionCode=${installedBuild.versionCode || "unknown"}`,
  );
  console.log("ANDROID_QA next=install the Google Play build selected for review, or set TTC_ANDROID_EXPECTED_VERSION_NAME and TTC_ANDROID_EXPECTED_VERSION_CODE for the selected track");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

console.log("ANDROID_QA result=authorized device ready for private route QA");
