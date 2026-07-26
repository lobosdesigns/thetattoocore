import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3012").replace(/\/$/, "");
const routePath = process.env.CSP_OBSERVATION_PATH || "/login";
const targetUrl = `${baseUrl}${routePath}`;
const port = 9800 + Math.floor(Math.random() * 300);
const userDataDir = mkdtempSync(join(tmpdir(), "ttc-csp-observation-"));
const chromePath = findChrome();

if (!chromePath) {
  console.error("FAIL CSP observation could not find Chrome. Set CHROME_PATH to a Chrome executable.");
  process.exit(1);
}

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
  const tab = await newTab(port, targetUrl);
  const client = await connectCdp(tab.webSocketDebuggerUrl);
  const cspMessages = [];
  let mainHeaders = null;

  client.on("Log.entryAdded", (event) => {
    const text = event.entry?.text || "";
    if (isCspMessage(text)) cspMessages.push(text);
  });
  client.on("Runtime.consoleAPICalled", (event) => {
    const text = (event.args || []).map((arg) => arg.value || arg.description || "").join(" ");
    if (isCspMessage(text)) cspMessages.push(text);
  });
  client.on("Network.responseReceived", (event) => {
    if (event.type === "Document" && sameUrlWithoutHash(event.response?.url, targetUrl)) {
      mainHeaders = normalizeHeaders(event.response?.headers || {});
    }
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");

  const loadEvent = waitForEvent(client, "Page.loadEventFired", 15000).catch(() => {});
  await client.send("Page.navigate", { url: targetUrl });
  await loadEvent;
  await sleep(700);

  const reportOnly = mainHeaders?.["content-security-policy-report-only"] || "";
  const enforced = mainHeaders?.["content-security-policy"] || "";
  const failures = [];

  if (!reportOnly) failures.push("missing Content-Security-Policy-Report-Only header");
  if (enforced) failures.push("unexpected enforced Content-Security-Policy header");
  if (!reportOnly.includes("object-src 'none'")) failures.push("report-only CSP is missing object-src 'none'");

  await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `(() => {
      const object = document.createElement("object");
      object.type = "text/html";
      object.data = "data:text/html,<p>ttc-csp-observation-canary</p>";
      object.width = "1";
      object.height = "1";
      object.setAttribute("aria-hidden", "true");
      document.body.appendChild(object);
      return true;
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  const directives = dedupe(cspMessages.map(extractDirective).filter(Boolean));
  if (!directives.includes("object-src")) {
    failures.push("did not observe the object-src canary in browser CSP logs");
  }

  client.close();
  if (tab?.id) await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`).catch(() => {});

  if (failures.length > 0) {
    console.error(`FAIL CSP Report-Only browser observation for ${targetUrl}`);
    for (const failure of failures) console.error(`  ${failure}`);
    if (directives.length > 0) console.error(`  observed directives: ${directives.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS CSP Report-Only browser observation for ${targetUrl}`);
    console.log(`  observed directives: ${directives.join(", ")}`);
    console.log("  raw CSP violation messages were not persisted");
  }
} finally {
  await stopBrowser();
  removeTempProfile(userDataDir);
}

function isCspMessage(text) {
  return /content security policy|violates.*policy/i.test(text || "");
}

function extractDirective(message) {
  const directiveMatch = String(message).match(/directive:?[\s\"']+([a-z0-9-]+)/i);
  if (directiveMatch) return directiveMatch[1].toLowerCase();
  const fallbackMatch = String(message).match(/violates[^.]*([a-z0-9-]+-src)/i);
  return fallbackMatch?.[1]?.toLowerCase() || null;
}

function normalizeHeaders(headers) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers || {})) {
    normalized[key.toLowerCase()] = String(value);
  }
  return normalized;
}

function sameUrlWithoutHash(a, b) {
  try {
    const first = new URL(a);
    const second = new URL(b);
    first.hash = "";
    second.hash = "";
    return first.href === second.href;
  } catch {
    return false;
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
    for (const handler of handlers) handler(data.params || {});
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
  if (!response.ok) throw new Error(`Could not create Chrome tab: ${response.status}`);
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

async function stopBrowser() {
  if (browser.exitCode !== null) return;
  const exited = new Promise((resolve) => browser.once("exit", resolve));
  browser.kill();
  await Promise.race([exited, sleep(3000)]);
}

function removeTempProfile(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(path, { force: true, recursive: true });
      return;
    } catch (error) {
      if (attempt === 4) console.warn(`WARN could not remove temporary Chrome profile: ${error.message}`);
    }
  }
}

function dedupe(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}