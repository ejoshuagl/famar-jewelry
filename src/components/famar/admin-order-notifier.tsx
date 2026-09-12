'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { useEffect } from 'react'

const LAST_ORDER_KEY = 'famar-admin-last-order'

export function AdminOrderNotifier({ pushActive = false }: { pushActive?: boolean }) {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const adminName = useAuthStore((state) => state.adminName)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onPush = (event: MessageEvent) => {
      if (event.data?.type !== 'famar-order-push') return
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
    navigator.serviceWorker.addEventListener('message', onPush)
    return () => navigator.serviceWorker.removeEventListener('message', onPush)
  }, [queryClient])

  useQuery({
    queryKey: ['admin-new-order-notifier'],
    queryFn: async () => {
      const response = await fetch('/api/orders?limit=1&page=1', {
        cache: 'no-store',
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!response.ok) throw new Error('No se pudo consultar pedidos nuevos')
      const data = await response.json() as { orders?: Array<{ id: string; orderNumber: string; customerName: string; total: number }> }
      const latest = data.orders?.[0]
      if (!latest) return null

      const previousId = window.sessionStorage.getItem(LAST_ORDER_KEY)
      window.sessionStorage.setItem(LAST_ORDER_KEY, latest.id)
      if (!pushActive && previousId && previousId !== latest.id) {
        toast.success(`Nuevo pedido #${latest.orderNumber}`, {
          description: `${latest.customerName} · $${Number(latest.total).toFixed(2)}`,
          action: { label: 'Ver pedido', onClick: () => useAppStore.getState().navigate('admin-orders') },
          duration: 12_000,
        })
        void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
        void queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      }
      return latest.id
    },
    enabled: isAuthenticated,
    refetchInterval: pushActive ? false : 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  return null
}
