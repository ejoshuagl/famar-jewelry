'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useCartStore } from '@/stores/cart-store'
import { useAppStore } from '@/stores/app-store'
import { syncCartState } from '@/lib/track-store-event'

const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000

export function CartReminder() {
  const itemCount = useCartStore((state) => state.getItemCount())
  const lastUpdatedAt = useCartStore((state) => state.lastUpdatedAt)
  const distinctCount = useCartStore((state) => state.items.length)
  const currentView = useAppStore((state) => state.currentView)

  useEffect(() => {
    syncCartState(itemCount, distinctCount)
  }, [itemCount, distinctCount])

  useEffect(() => {
    if (!itemCount || !lastUpdatedAt || currentView === 'cart') return
    if (Date.now() - lastUpdatedAt < REMINDER_AFTER_MS) return
    const reminderKey = `famar-cart-reminder-${new Date().toISOString().slice(0, 10)}`
    if (window.sessionStorage.getItem(reminderKey)) return
    window.sessionStorage.setItem(reminderKey, '1')
    toast.info(`Tienes ${itemCount} producto${itemCount === 1 ? '' : 's'} esperando en tu carrito`, {
      action: { label: 'Ver carrito', onClick: () => useAppStore.getState().navigate('cart') },
      duration: 7000,
    })
  }, [currentView, itemCount, lastUpdatedAt])

  return null
}
