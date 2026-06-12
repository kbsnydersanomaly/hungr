// Stub to purge old Firebase Cloud Messaging service worker
// The old React app registered this SW; this replacement unregisters itself.

self.addEventListener("install", (_event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      console.log("[hungr] Old Firebase service worker unregistered.");
      // Clear any cached clients so the browser doesn't keep using this SW
      return self.clients.claim().then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
      );
    })
  );
});

// No-op fetch handler — nothing to do here
self.addEventListener("fetch", (_event) => {
  // pass through
});
