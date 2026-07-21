import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const baseUrl = (process.env.SMOKE_BASE_URL || "https://thetattoocore.com").replace(/\/$/, "");
const mobileProfiles = {
  android: {
    height: 844,
    label: "Android Chrome",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 TheTattooCoreMobileSmoke/1.0",
    width: 390,
  },
  ios: {
    height: 844,
    label: "iPhone Safari",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 TheTattooCoreMobileSmoke/1.0",
    width: 390,
  },
};
const mobileProfileName = (process.env.SMOKE_MOBILE_PROFILE || "android").toLowerCase();
const mobileProfile = mobileProfiles[mobileProfileName];
if (!mobileProfile) {
  console.error(
    `FAIL unknown SMOKE_MOBILE_PROFILE "${mobileProfileName}". Use android or ios.`,
  );
  process.exit(1);
}
const width = Number(process.env.SMOKE_MOBILE_WIDTH || mobileProfile.width);
const height = Number(process.env.SMOKE_MOBILE_HEIGHT || mobileProfile.height);
const userAgent = process.env.SMOKE_MOBILE_USER_AGENT || mobileProfile.userAgent;
const routeAttempts = Math.max(
  1,
  Number.parseInt(process.env.SMOKE_MOBILE_ROUTE_ATTEMPTS || "5", 10),
);
const routeRetryDelayMs = Math.max(
  100,
  Number.parseInt(process.env.SMOKE_MOBILE_ROUTE_RETRY_MS || "5000", 10),
);
const routeSettleDelayMs = Math.max(
  0,
  Number.parseInt(process.env.SMOKE_MOBILE_ROUTE_SETTLE_MS || "2000", 10),
);
const routes = [
  { path: "/", titleIncludes: "Sign in" },
  { path: "/login", titleIncludes: "Sign in" },
  { path: "/signup", titleIncludes: "Create account" },
  {
    path: "/forgot-password",
    textIncludes: ["Send reset link", "Help Center"],
    titleIncludes: "Reset password",
  },
  {
    path: "/reset-password",
    textIncludes: ["Create new password", "Help Center"],
    titleIncludes: "Reset password",
  },
  {
    path: "/auth/confirm?next=%2Fmessages&code=bad",
    textIncludes: "Could not confirm your email",
    titleIncludes: "Sign in",
  },
  {
    path: "/support",
    textIncludes: ["support@thetattoocore.com", "Beta app testing"],
    titleIncludes: "Support",
  },
  { path: "/help", textIncludes: "Search Help Center", titleIncludes: "Help Center" },
  {
    path: "/help/beta-tester-checklist",
    textIncludes: ["Beta tester checklist", "What counts as a beta blocker?"],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/beta-app-testing",
    textIncludes: ["How to test the beta app", "What should I test first?"],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/booking-appointments",
    textIncludes: "How to create appointment types, time slots, and booking deposits",
    titleIncludes: "Help Center",
  },
  {
    path: "/help/booking-appointments?comments=50",
    textIncludes: ["Guide Questions", "Ask deeper workflow questions here"],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/search-saved-people",
    textIncludes: "How to search, find people, and use Saved",
    titleIncludes: "Help Center",
  },
  {
    path: "/help/privacy-safety-support",
    textIncludes: "How to use reports, blocks, privacy, and support",
    titleIncludes: "Help Center",
  },
  {
    path: "/help/posting-stories-dms",
    textIncludes: [
      "How to post, use Stories, and DM safely",
      "Stories rail preview",
      "Gossip discussion preview",
    ],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/merch-products-orders",
    textIncludes: ["How to set up Merch products and handle orders", "What if a package has a problem?"],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/order-refunds-disputes",
    textIncludes: ["Order support, refunds, and disputes", "What happens if there is a dispute?"],
    titleIncludes: "Help Center",
  },
  {
    path: "/help/seller-payouts-payment-safety",
    textIncludes: ["Seller payouts and payment safety", "Should I send payout details to support?"],
    titleIncludes: "Help Center",
  },
  { path: "/privacy", textIncludes: "support@thetattoocore.com", titleIncludes: "Privacy" },
  { path: "/terms", textIncludes: "visible nudity is not allowed", titleIncludes: "Terms" },
  { path: "/search?q=ceocore", textIncludes: "@ceocore", titleIncludes: "Search" },
  {
    path: "/search?q=shirts&type=merch",
    textIncludes: ["Merch", "Merch checkout stays review-controlled", "Filter"],
    titleIncludes: "Search",
  },
  { path: "/messages", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/messages?to=tattedhotlegs", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/notifications", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/api/bookings/bad/calendar", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/saved", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/account", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/account?booking_status=requested", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/profile", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/location", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/language", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/socials", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/appearance", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/privacy", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/notifications", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/bookings", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/orders", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/help", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/verification", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/settings/ads", textIncludes: "Sign in", titleIncludes: "Sign in" },
  { path: "/u/ceocore", textIncludes: "@ceocore", titleIncludes: "CEOCore" },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-4u",
    textIncludes: "@ceocore",
    titleIncludes: "CEOCore",
  },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-gossip",
    textIncludes: ["@ceocore", "Longer posts, questions, and shop talk."],
    titleIncludes: "CEOCore",
  },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-stuff",
    textIncludes: ["@ceocore", "Flash, supplies, studio gear, and services."],
    titleIncludes: "CEOCore",
  },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-gigs",
    textIncludes: ["@ceocore", "Jobs, conventions, guest spots, and events."],
    titleIncludes: "CEOCore",
  },
  {
    path: "/u/ceocore?profile_4u=50&profile_gossip=50&profile_stuff=50&profile_gigs=50&profile_merch=50#profile-merch",
    textIncludes: ["@ceocore", "Fan-facing shirts, prints, art, stickers, and brand goods."],
    titleIncludes: "CEOCore",
  },
  { path: "/u/ceocore/followers", textIncludes: "community", titleIncludes: "Followers" },
  { path: "/u/ceocore/following", textIncludes: "community", titleIncludes: "Following" },
  { allowMainDocument404: true, path: "/p/not-a-real-post", titleIncludes: "404" },
  {
    allowMainDocument404: true,
    path: "/t/not-a-real-thread",
    titleIncludesAny: ["Gossip thread not found", "404"],
  },
  { allowMainDocument404: true, path: "/stuff/not-a-real-listing", titleIncludes: "404" },
  { allowMainDocument404: true, path: "/gigs/not-a-real-gig", titleIncludes: "404" },
  { path: "/merch", textIncludes: ["Merch help", "Seller tools"], titleIncludes: "Merch" },
  { allowMainDocument404: true, path: "/merch/not-a-real-product", titleIncludes: "404" },
  { path: "/merch/checkout/success", titleIncludes: "Merch checkout status" },
];
const representativeSitemapPrefixes = ["/p/", "/t/", "/stuff/", "/gigs/", "/merch/", "/u/"];
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

routes.push(...(await representativeSitemapRoutes()));

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
    const result = await checkRouteWithRetry(port, `${baseUrl}${route.path}`, route);
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${route.path}`);

    if (!result.ok) {
      failures += 1;
      for (const reason of result.reasons) {
        console.error(`  ${reason}`);
      }
    }

    if (routeSettleDelayMs) {
      await sleep(routeSettleDelayMs);
    }
  }

  if (failures) {
    console.error(`${failures} mobile browser smoke check(s) failed for ${baseUrl}`);
    process.exitCode = 1;
  } else {
    console.log(
      `All mobile browser smoke checks passed for ${baseUrl} at ${width}px using ${mobileProfile.label}.`,
    );
  }
} finally {
  await stopBrowser();
  removeTempProfile(userDataDir);
}

async function checkRouteWithRetry(portNumber, url, route) {
  let lastResult;

  for (let attempt = 0; attempt < routeAttempts; attempt += 1) {
    const result = await checkRoute(portNumber, url, route);
    lastResult = result;

    if (result.ok || !isTransientRouteFailure(result)) {
      return result;
    }

    if (attempt < routeAttempts - 1) {
      await sleep(routeRetryDelayMs * (attempt + 1));
    }
  }

  return lastResult;
}

function isTransientRouteFailure(result) {
  return result.reasons.some(
    (reason) =>
      reason.includes("503 ") ||
      reason.includes("429 ") ||
      reason.includes("Timed out waiting for Page.navigate") ||
      reason.includes("browser check error") ||
      reason.includes("Worker exceeded resource limits") ||
      isFreshDeployStaticAssetMiss(reason),
  );
}

function isFreshDeployStaticAssetMiss(reason) {
  return (
    reason.includes("404 ") &&
    reason.includes("/_next/static/") &&
    !reason.includes("Document")
  );
}

function routeTextIncludes(route) {
  if (!route.textIncludes) return [];
  return Array.isArray(route.textIncludes) ? route.textIncludes : [route.textIncludes];
}

async function checkRoute(portNumber, url, route) {
  let tab;
  let client;
  const errors = [];
  const networkErrors = [];

  try {
    tab = await newTab(portNumber, url);
    client = await connectCdp(tab.webSocketDebuggerUrl);

    client.on("Runtime.exceptionThrown", (event) => {
      const text = event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || "page exception";
      errors.push(text);
    });
    client.on("Log.entryAdded", (event) => {
      if (event.entry?.level === "error") {
        errors.push(event.entry.text);
      }
    });
    client.on("Network.responseReceived", (event) => {
      const status = event.response?.status || 0;
      const isAllowedMainDocument404 =
        route.allowMainDocument404 && event.type === "Document" && status === 404;

      const isIgnoredBrowserAsset404 =
        status === 404 && event.response?.url?.endsWith("/favicon.ico");

      if (status >= 400 && !isAllowedMainDocument404 && !isIgnoredBrowserAsset404) {
        networkErrors.push(`${status} ${event.response?.url || "resource"}`);
      }
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Network.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 3,
      height,
      mobile: true,
      width,
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent,
    });
    const loadEvent = waitForEvent(client, "Page.loadEventFired", 15000).catch(() => {});
    await client.send("Page.navigate", { url });
    await loadEvent;
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
          text,
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
    if (route.titleIncludes && !String(value.title || "").includes(route.titleIncludes)) {
      reasons.push(`title "${value.title || ""}" did not include "${route.titleIncludes}"`);
    }
    if (
      route.titleIncludesAny &&
      !route.titleIncludesAny.some((titleText) => String(value.title || "").includes(titleText))
    ) {
      reasons.push(
        `title "${value.title || ""}" did not include one of "${route.titleIncludesAny.join(", ")}"`,
      );
    }
    for (const requiredText of routeTextIncludes(route)) {
      if (!String(value.text || "").includes(requiredText)) {
        reasons.push(`page text did not include "${requiredText}"`);
      }
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
    if (networkErrors.length) {
      reasons.push(`network errors: ${dedupe(networkErrors).slice(0, 3).join(" | ")}`);
    }

    return { ok: reasons.length === 0, reasons };
  } catch (error) {
    const reasons = [`browser check error: ${error.message}`];
    if (networkErrors.length) {
      reasons.push(`network errors: ${dedupe(networkErrors).slice(0, 3).join(" | ")}`);
    }
    if (errors.length) {
      reasons.push(`console/page errors: ${dedupe(errors).slice(0, 3).join(" | ")}`);
    }
    return { ok: false, reasons };
  } finally {
    client?.close();
    if (tab?.id) {
      await fetch(`http://127.0.0.1:${portNumber}/json/close/${tab.id}`).catch(() => {});
    }
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

async function representativeSitemapRoutes() {
  try {
    const response = await fetch(`${baseUrl}/sitemap.xml`, {
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((match) => {
        try {
          return new URL(match[1]);
        } catch {
          return null;
        }
      })
      .filter((url) => url?.origin === baseUrl);
    const sampled = representativeSitemapPrefixes
      .map((prefix) => urls.find((url) => url.pathname.startsWith(prefix)))
      .filter(Boolean);

    return sampled.map((url) => ({
      path: `${url.pathname}${url.search}`,
      titleIncludes: "",
    }));
  } catch {
    return [];
  }
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
