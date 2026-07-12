self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(fetch(event.request));
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

    return `${url.pathname}${url.search}${url.hash}` || "/notifications";
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : "/notifications";
  }
}
