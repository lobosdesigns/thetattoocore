import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const width = Number(process.env.SMOKE_MOBILE_WIDTH || 390);
const height = Number(process.env.SMOKE_MOBILE_HEIGHT || 844);
const routes = [
  { path: "/" },
  { path: "/login" },
  { path: "/signup" },
  { path: "/forgot-password" },
  { path: "/reset-password" },
  { path: "/support" },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/search?q=ceocore" },
  { path: "/u/ceocore" },
  { path: "/u/ceocore/followers" },
  { path: "/u/ceocore/following" },
  { allowMainDocument404: true, path: "/p/not-a-real-post" },
  { allowMainDocument404: true, path: "/t/not-a-real-thread" },
  { allowMainDocument404: true, path: "/stuff/not-a-real-listing" },
  { allowMainDocument404: true, path: "/gigs/not-a-real-gig" },
  { allowMainDocument404: true, path: "/merch/not-a-real-product" },
  { path: "/merch/checkout/success" },
];
const forbiddenText = [
  "This page couldn't load",
  "Reload to try again",
  "Application error",
  "Internal Server Error",
];

const chromePath = findChrome();
if (!chromePath) {
  console.error("FAIL mobile browser smoke needs Chrome or Chromium. Set CHROME_PATH to a browser executable.");
  process.exit(1);
}

const port = 9400 + Math.floor(Math.random() * 300);
const userDataDir = mkdtempSync(join(tmpdir(), "ttc-mobile-smoke-"));
const browser = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], {
  stdio: ["ignore", "ignore", "pipe"],
});

let browserStderr = "";
browser.stderr.on("data", (chunk) => {
  browserStderr += chunk.toString();
});

try {
  await waitForDevtools(port);

  let failures = 0;
  for (const route of routes) {
    const result = await checkRoute(port, `${baseUrl}${route.path}`, route);
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${route.path}`);

    if (!result.ok) {
      failures += 1;
      for (const reason of result.reasons) {
        console.error(`  ${reason}`);
      }
    }
  }

  if (failures) {
    console.error(`${failures} mobile browser smoke check(s) failed for ${baseUrl}`);
    process.exitCode = 1;
  } else {
    console.log(`All mobile browser smoke checks passed for ${baseUrl} at ${width}px.`);
  }
} finally {
  await stopBrowser();
  removeTempProfile(userDataDir);
}

async function checkRoute(portNumber, url, route) {
  const tab = await newTab(portNumber, url);
  const client = await connectCdp(tab.webSocketDebuggerUrl);
  const errors = [];

  client.on("Runtime.exceptionThrown", (event) => {
    const text = event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || "page exception";
    errors.push(text);
  });
  client.on("Log.entryAdded", (event) => {
    if (event.entry?.level === "error") {
      errors.push(event.entry.text);
    }
  });

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 3,
      height,
      mobile: true,
      width,
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 TheTattooCoreMobileSmoke/1.0",
    });
    await client.send("Page.navigate", { url });
    await waitForEvent(client, "Page.loadEventFired", 9000);
    await sleep(700);

    const evaluation = await client.send("Runtime.evaluate", {
      awaitPromise: true,
      expression: `(() => {
        const doc = document.documentElement;
        const body = document.body;
        const text = body?.innerText || "";
        const maxScrollWidth = Math.max(doc?.scrollWidth || 0, body?.scrollWidth || 0);
        const clientWidth = doc?.clientWidth || ${width};
        return {
          clientWidth,
          finalUrl: location.href,
          forbidden: ${JSON.stringify(forbiddenText)}.filter((snippet) => text.includes(snippet)),
          scrollWidth: maxScrollWidth,
          title: document.title,
        };
      })()`,
      returnByValue: true,
    });
    const value = evaluation.result?.value || {};
    const overflow = Math.max(0, (value.scrollWidth || 0) - (value.clientWidth || width));
    const reasons = [];

    if (value.forbidden?.length) {
      reasons.push(`found reload/error text: ${value.forbidden.join(", ")}`);
    }
    if (overflow > 2) {
      reasons.push(`horizontal overflow ${overflow}px (${value.scrollWidth}px document on ${value.clientWidth}px viewport)`);
    }
    const filteredErrors = route.allowMainDocument404
      ? errors.filter((error) => !error.includes("the server responded with a status of 404"))
      : errors;

    if (filteredErrors.length) {
      reasons.push(`console/page errors: ${dedupe(filteredErrors).slice(0, 3).join(" | ")}`);
    }

    return { ok: reasons.length === 0, reasons };
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${portNumber}/json/close/${tab.id}`).catch(() => {});
  }
}

function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const callbacks = new Map();
  const listeners = new Map();

  ws.addEventListener("message", (message) => {
    const data = JSON.parse(message.data.toString());
    if (data.id && callbacks.has(data.id)) {
      const { reject, resolve } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
      else resolve(data.result || {});
      return;
    }

    const handlers = listeners.get(data.method) || [];
    for (const handler of handlers) {
      handler(data.params || {});
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        close() {
          ws.close();
        },
        on(method, handler) {
          const handlers = listeners.get(method) || [];
          handlers.push(handler);
          listeners.set(method, handlers);
        },
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            callbacks.set(id, { reject: rejectCommand, resolve: resolveCommand });
            setTimeout(() => {
              if (callbacks.has(id)) {
                callbacks.delete(id);
                rejectCommand(new Error(`Timed out waiting for ${method}`));
              }
            }, 10000);
          });
        },
      });
    });
    ws.addEventListener("error", () => reject(new Error("Could not connect to Chrome DevTools.")));
  });
}

async function waitForEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
    client.on(method, (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
}

async function newTab(portNumber, url) {
  const response = await fetch(`http://127.0.0.1:${portNumber}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Could not create Chrome tab: ${response.status}`);
  }
  return response.json();
}

async function waitForDevtools(portNumber) {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (browser.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready. ${browserStderr}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${portNumber}/json/version`);
      if (response.ok) return;
    } catch {
      // Keep polling while Chrome starts.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for Chrome DevTools. ${browserStderr}`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    join(process.env.LOCALAPPDATA || "", "ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe"),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function dedupe(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

async function stopBrowser() {
  if (browser.exitCode !== null) return;

  const exited = new Promise((resolve) => {
    browser.once("exit", resolve);
  });
  browser.kill();
  await Promise.race([exited, sleep(3000)]);
}

function removeTempProfile(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(path, { force: true, recursive: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`WARN could not remove temporary Chrome profile: ${error.message}`);
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
