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
  Boxes,
  Receipt,
} from 'lucide-react'

interface DaySales {
  day: string
  total: number
  count: number
}

interface DashboardStats {
  totalProducts: number
  totalOrders: number
  pendingOrders: number
  confirmedOrders: number
  totalRevenue: number
  avgOrderValue: number
  salesLast7Days: DaySales[]
  availability: {
    availableCount: number
    lowStockCount: number
    outOfStockCount: number
    hiddenCount: number
  }
  salesByCategory: { name: string; sales: number }[]
  recentOrders: {
    id: string
    orderNumber: string
    customerName: string
    total: number
    status: string
    createdAt: string
  }[]
}

export function AdminDashboardView() {
  const { adminName } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats', {
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) throw new Error('Unauthorized')
      return res.json() as Promise<DashboardStats>
    },
    enabled: !!adminName,
  })

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
      label: 'Ingresos Confirmados',
      value: formatPrice(stats.totalRevenue),
      icon: <DollarSign className="h-5 w-5 text-primary" />,
    },
    {
      label: 'Ticket Promedio',
      value: formatPrice(stats.avgOrderValue),
      icon: <Receipt className="h-5 w-5 text-primary" />,
    },
    {
      label: 'Pendientes',
      value: stats.pendingOrders,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
    },
    {
      label: 'Confirmados',
      value: stats.confirmedOrders,
      icon: <ShoppingBag className="h-5 w-5 text-green-500" />,
    },
  ]

  const maxDayTotal = Math.max(...stats.salesLast7Days.map((d) => d.total), 1)
  const { availableCount, lowStockCount, outOfStockCount, hiddenCount } = stats.availability
  const inventoryTotal = availableCount + lowStockCount + outOfStockCount + hiddenCount || 1
  const pct = (n: number) => Math.round((n / inventoryTotal) * 100)
  const maxCatSales = Math.max(...stats.salesByCategory.map((c) => c.sales), 1)

  const availabilityBars = [
    {
      label: 'Disponibles (stock alto)',
      count: availableCount,
      color: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Stock bajo (1-5 uds)',
      count: lowStockCount,
      color: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Agotados',
      count: outOfStockCount,
      color: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Ocultos',
      count: hiddenCount,
      color: 'bg-gray-400',
      text: 'text-muted-foreground',
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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                {stat.icon}
              </div>
              <p className="text-xl font-bold truncate">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales last 7 days */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Ventas últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {stats.salesLast7Days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">
                    {d.total > 0 ? formatPrice(d.total) : ''}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary min-h-[4px] transition-all"
                    style={{ height: `${Math.max((d.total / maxDayTotal) * 100, 2)}%` }}
                    title={`${d.count} pedidos`}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inventory availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Disponibilidad del inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-4 w-full rounded-full overflow-hidden">
              {availabilityBars.map((b) => (
                b.count > 0 && (
                  <div
                    key={b.label}
                    className={b.color}
                    style={{ width: `${pct(b.count)}%` }}
                    title={`${b.label}: ${b.count}`}
                  />
                )
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {availabilityBars.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${b.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{b.label}</p>
                    <p className={`text-sm font-bold ${b.text}`}>
                      {b.count} <span className="text-xs font-normal text-muted-foreground">({pct(b.count)}%)</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                {stats.recentOrders.map((order) => (
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

        {/* Sales by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Unidades vendidas por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.salesByCategory.some((c) => c.sales > 0) ? (
              stats.salesByCategory.map((c) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{c.sales} uds</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                      style={{ width: `${(c.sales / maxCatSales) * 100}%` }}
                    />
                  </div>
                </div>
              ))
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
