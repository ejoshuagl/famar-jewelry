'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import {
  Package,
  ShoppingBag,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import type { ProductData } from './product-card'

export function AdminDashboardView() {
  const { adminName } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats', {
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) throw new Error('Unauthorized')
      return res.json()
    },
    enabled: !!adminName,
  })

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Productos',
      value: stats.totalProducts,
      icon: <Package className="h-5 w-5 text-primary" />,
    },
    {
      label: 'Total Pedidos',
      value: stats.totalOrders,
      icon: <ShoppingBag className="h-5 w-5 text-primary" />,
    },
    {
      label: 'Ingresos',
      value: formatPrice(stats.totalRevenue),
      icon: <DollarSign className="h-5 w-5 text-primary" />,
    },
    {
      label: 'Pedidos Pendientes',
      value: stats.pendingOrders,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido, {adminName}. Aquí tienes un resumen de tu tienda.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Pedidos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order: { id: string; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">#{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatPrice(order.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.status === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        {order.status === 'confirmed' ? 'Confirmado' : order.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay pedidos aún
              </p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStock && stats.lowStock.length > 0 ? (
              <div className="space-y-3">
                {stats.lowStock.map((product: ProductData) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.code}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {product.stock} uds
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todo el stock está en buen nivel
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Selling */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Más Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topSelling && stats.topSelling.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {stats.topSelling.map((product: ProductData, idx: number) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-2xl font-bold text-primary/30">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[120px]">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.salesCount} ventas</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay datos de ventas aún
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}