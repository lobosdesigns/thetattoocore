import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const requireDevice = process.argv.includes("--require-device");

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
  devices = parseDevices(runAdb(adb, ["devices", "-l"]));
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
  if (devices.length === 0) {
    console.log("ANDROID_QA next=check USB cable, set USB mode to file transfer, and reopen the USB debugging prompt");
  }
  if (requireDevice) process.exit(1);
  process.exit(0);
}

const primary = authorizedDevices[0];
const shell = (args) => runAdb(adb, ["-s", primary.serial, "shell", ...args]);

let model = "unknown";
let osVersion = "unknown";
let packageSummary = "not installed";
let packageInstalled = false;

try {
  model = shell(["getprop", "ro.product.model"]);
  osVersion = shell(["getprop", "ro.build.version.release"]);
} catch {
  // Keep the output repo-safe and continue to package check.
}

try {
  const packageDump = shell(["dumpsys", "package", "com.thetattoocore.app"]);
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
console.log(`ANDROID_QA package=${packageSummary}`);

if (!packageInstalled) {
  console.log("ANDROID_QA result=authorized device missing TTC package");
  console.log("ANDROID_QA next=install or confirm the Google Play internal-testing build before route QA");
  if (requireDevice) process.exit(1);
  process.exit(0);
}

console.log("ANDROID_QA result=authorized device ready for private route QA");
