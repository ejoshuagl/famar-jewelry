'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

function excludeAdminTraffic(event: BeforeSendEvent) {
  const url = new URL(event.url, window.location.origin)
  const isAdminRoute = url.pathname === '/admin'
    || url.pathname.startsWith('/admin/')
    || url.hash === '#/admin-login'
    || url.hash.startsWith('#/admin-')

  return isAdminRoute ? null : event
}

export function StoreAnalytics() {
  return <Analytics beforeSend={excludeAdminTraffic} />
}
