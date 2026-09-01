'use client'

type StoreEventType = 'product_view' | 'add_to_cart' | 'cart_view' | 'checkout_started' | 'order_created' | 'whatsapp_opened' | 'campaign_click'

function sessionId() {
  const key = 'famar-session-id'
  let value = window.localStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID()
    window.localStorage.setItem(key, value)
  }
  return value
}

export function trackStoreEvent(type: StoreEventType, data: { productId?: string; campaignId?: string } = {}) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify({ type, sessionId: sessionId(), ...data })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/store-events', new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch('/api/store-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
}
