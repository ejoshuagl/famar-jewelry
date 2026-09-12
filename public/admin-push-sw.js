// Notifications only: no fetch handler, caching or offline storefront changes.
self.addEventListener('push', (event) => {
  let message = {}
  try { message = event.data?.json() || {} } catch { /* Generic notification below. */ }
  event.waitUntil(Promise.all([
    self.registration.showNotification(message.title || 'Nuevo pedido en FAMAR', {
      body: message.body || 'Abre administración para revisar el pedido.',
      tag: message.tag || 'famar-new-order',
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) if (new URL(client.url).pathname.startsWith('/admin')) client.postMessage({ type: 'famar-order-push' })
    }),
  ]))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Fixed same-origin destination; never navigate to a URL supplied in a payload.
  event.waitUntil(self.clients.openWindow('/admin/pedidos'))
})
