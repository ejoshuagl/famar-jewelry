'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'

const LAST_ORDER_KEY = 'famar-admin-last-order'

export function AdminOrderNotifier() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.token)
  const adminName = useAuthStore((state) => state.adminName)

  useQuery({
    queryKey: ['admin-new-order-notifier'],
    queryFn: async () => {
      const response = await fetch('/api/orders?limit=1&page=1', {
        cache: 'no-store',
        headers: { 'x-admin-name': adminName || '', 'x-admin-token': token || '' },
      })
      if (!response.ok) throw new Error('No se pudo consultar pedidos nuevos')
      const data = await response.json() as { orders?: Array<{ id: string; orderNumber: string; customerName: string; total: number }> }
      const latest = data.orders?.[0]
      if (!latest) return null

      const previousId = window.sessionStorage.getItem(LAST_ORDER_KEY)
      window.sessionStorage.setItem(LAST_ORDER_KEY, latest.id)
      if (previousId && previousId !== latest.id) {
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
    enabled: Boolean(token),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  return null
}
