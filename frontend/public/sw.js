/* Sclero Proteins service worker: standards-based Web Push only. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Sclero Proteins', {
    body: payload.body || 'There is an update from Sclero Proteins.',
    icon: '/icon-192.png',
    badge: '/icon-64.png',
    tag: payload.campaignId ? `campaign-${payload.campaignId}` : 'store-update',
    data: { targetUrl: payload.targetUrl || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedPath = event.notification.data?.targetUrl || '/';
  const destination = new URL(requestedPath, self.location.origin);
  if (destination.origin !== self.location.origin) destination.pathname = '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) return existing.navigate(destination.href).then(() => existing.focus());
      return self.clients.openWindow(destination.href);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push/config/')
      .then((response) => response.json())
      .then(async (config) => {
        if (!config.enabled || !config.public_key) return;
        const padding = '='.repeat((4 - (config.public_key.length % 4)) % 4);
        const base64 = (config.public_key + padding).replace(/-/g, '+').replace(/_/g, '/');
        const key = Uint8Array.from([...atob(base64)].map((character) => character.charCodeAt(0)));
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        const payload = subscription.toJSON();
        return fetch('/api/push/subscriptions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: payload.endpoint,
            previous_endpoint: event.oldSubscription?.endpoint || '',
            keys: payload.keys,
            client_id: crypto.randomUUID(),
          }),
        });
      })
  );
});
