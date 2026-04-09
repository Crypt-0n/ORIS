import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare const self: any;

// Workbox precaching
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Single Page Application (SPA) navigation route
const handler = createHandlerBoundToURL('index.html');
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// Push notification handler
self.addEventListener('push', (event: any) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/Logo.png',
      badge: '/Logo.png',
      data: { link: data.link || '/' },
      vibrate: [200, 100, 200],
      tag: 'oris-notification',
      renotify: true,
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'ORIS', options)
    );
  } catch (e) {
    console.error('[SW] Push parse error:', e);
  }
});

// Click on push notification → navigate
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients: any[]) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return self.clients.openWindow(link);
    })
  );
});

// Skip waiting and claim clients
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event: any) => {
  event.waitUntil(self.clients.claim());
});
