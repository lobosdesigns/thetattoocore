const STATIC_CACHE_NAME = "ttc-static-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_CACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/splash/splash-2048.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ttc-static-") && key !== STATIC_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (url.origin === self.location.origin && isStaticShellAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event.data);
  const title = payload.title || "TheTattooCore";
  const url = safeNotificationPath(payload.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: "/icons/icon-192.png",
      body: payload.body || "You have a new update.",
      data: { url },
      icon: "/icons/icon-192.png",
      tag: payload.tag || "ttc-notification",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = safeNotificationPath(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);

        if (clientUrl.origin === self.location.origin && client.focus) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});

function parsePushPayload(data) {
  if (!data) return {};

  try {
    return data.json();
  } catch {
    return { body: data.text() };
  }
}

function safeNotificationPath(value) {
  if (typeof value !== "string") return "/notifications";

  try {
    const url = new URL(value, self.location.origin);

    if (url.origin !== self.location.origin) return "/notifications";

    return allowedNotificationPath(url);
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/notifications";

    try {
      return allowedNotificationPath(new URL(value, self.location.origin));
    } catch {
      return "/notifications";
    }
  }
}

function allowedNotificationPath(url) {
  const allowedPaths = [
    "/",
    "/account",
    "/messages",
    "/notifications",
    "/saved",
    "/search",
  ];
  const allowedPrefixes = ["/p/", "/t/", "/u/", "/merch/", "/stuff/", "/gigs/"];

  if (
    !allowedPaths.includes(url.pathname) &&
    !allowedPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return "/notifications";
  }

  return `${url.pathname}${url.search}${url.hash}` || "/notifications";
}

function isStaticShellAsset(pathname) {
  return (
    STATIC_CACHE_URLS.includes(pathname) ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/splash/")
  );
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return (
      (await caches.match(OFFLINE_URL)) ||
      new Response("TheTattooCore is offline. Reconnect and try again.", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        status: 503,
      })
    );
  }
}
