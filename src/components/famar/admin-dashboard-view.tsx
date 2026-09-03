'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
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
    availableUnits: number
    oneUnitCount: number
    twoUnitsCount: number
    threePlusCount: number
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
  funnel: { product_view: number; add_to_cart: number; checkout_started: number; order_created: number }
  funnelPeriod: string
  funnelRange: { from: string; to: string }
  funnelDaily: Array<{ date: string; product_view: number; add_to_cart: number; checkout_started: number; order_created: number }>
  activeCarts: { activeCarts: number; activeItems: number }
}

export function AdminDashboardView() {
  const { adminName } = useAuthStore()
  const [salesPeriod, setSalesPeriod] = useState('7')
  const [funnelPeriod, setFunnelPeriod] = useState('today')
  const [funnelFrom, setFunnelFrom] = useState('')
  const [funnelTo, setFunnelTo] = useState('')

  const periods = [
    { value: '7', label: '7 días' },
    { value: '30', label: '30 días' },
    { value: '90', label: '90 días' },
    { value: 'all', label: 'Todo' },
  ]

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', salesPeriod, funnelPeriod, funnelFrom, funnelTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period: salesPeriod, funnelPeriod })
      if (funnelPeriod === 'custom' && funnelFrom && funnelTo) {
        params.set('funnelFrom', funnelFrom)
        params.set('funnelTo', funnelTo)
      }
      const res = await fetch(`/api/stats?${params}`, {
        headers: { 'x-admin-name': adminName || '',
          'x-admin-token': useAuthStore.getState().token || '' },
      })
      if (!res.ok) throw new Error('Unauthorized')
      return res.json() as Promise<DashboardStats>
    },
    enabled: !!adminName,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
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
  const { availableUnits, oneUnitCount, twoUnitsCount, threePlusCount, outOfStockCount, hiddenCount } = stats.availability
  const maxCatSales = Math.max(...stats.salesByCategory.map((c) => c.sales), 1)
  const funnelPeriods = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'all', label: 'Todo' },
    { value: 'custom', label: 'Elegir fechas' },
  ]

  const inventoryGroups = [
    {
      label: 'Con 1 unidad',
      count: oneUnitCount,
      text: 'text-primary',
    },
    {
      label: 'Con 2 unidades',
      count: twoUnitsCount,
      text: 'text-primary',
    },
    {
      label: 'Con 3 unidades o más',
      count: threePlusCount,
      text: 'text-primary',
    },
    {
      label: 'Agotados',
      count: outOfStockCount,
      text: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Ocultos',
      count: hiddenCount,
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
        {/* Sales chart with period selector */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Ventas
            </CardTitle>
            <div className="flex gap-1">
              {periods.map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={salesPeriod === p.value ? 'default' : 'ghost'}
                  className={cn('h-7 px-2 text-xs', salesPeriod === p.value && 'bg-primary text-primary-foreground')}
                  onClick={() => setSalesPeriod(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-1 h-40">
              {stats.salesLast7Days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">
                    {d.total > 0 ? formatPrice(d.total) : ''}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary min-h-[4px] transition-all"
                    style={{ height: `${Math.max((d.total / maxDayTotal) * 100, 2)}%` }}
                    title={`${d.count} pedidos`}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize truncate max-w-full">{d.day}</span>
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
            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Existencias disponibles</p>
              <p className="text-3xl font-bold text-primary">{availableUnits}</p>
              <p className="text-xs text-muted-foreground">unidades en productos visibles</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {inventoryGroups.map((group) => (
                <div key={group.label} className="rounded-lg border p-3 text-center">
                  <p className={`text-xl font-bold ${group.text}`}>{group.count}</p>
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Embudo de compra <span className="ml-2 text-xs font-normal text-emerald-500">En vivo</span></CardTitle>
              <div className="flex flex-wrap gap-1">
                {funnelPeriods.map((item) => (
                  <Button key={item.value} size="sm" variant={funnelPeriod === item.value ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setFunnelPeriod(item.value)}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            {funnelPeriod === 'custom' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input type="date" aria-label="Fecha inicial del embudo" value={funnelFrom} onChange={(event) => setFunnelFrom(event.target.value)} />
                <Input type="date" aria-label="Fecha final del embudo" value={funnelTo} min={funnelFrom || undefined} onChange={(event) => setFunnelTo(event.target.value)} />
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-primary/5 p-3 text-center">
              <div><p className="text-xl font-bold text-primary">{stats.activeCarts?.activeCarts || 0}</p><p className="text-[10px] text-muted-foreground">Carritos activos</p></div>
              <div><p className="text-xl font-bold text-primary">{stats.activeCarts?.activeItems || 0}</p><p className="text-[10px] text-muted-foreground">Productos guardados ahora</p></div>
            </div>
            <p className="text-xs text-muted-foreground">Las cifras siguientes son acciones acumuladas del periodo y no disminuyen al borrar productos.</p>
            <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Vieron producto', stats.funnel?.product_view || 0],
              ['Al carrito', stats.funnel?.add_to_cart || 0],
              ['Iniciaron pedido', stats.funnel?.checkout_started || 0],
              ['Pedidos', stats.funnel?.order_created || 0],
            ].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><p className="text-xl font-bold text-primary">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}
            </div>
            <p className="text-xs text-muted-foreground">Periodo analizado: {stats.funnelRange?.from} — {stats.funnelRange?.to}</p>
            {stats.funnelDaily?.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-lg border">
                <div className="grid grid-cols-5 gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-medium text-muted-foreground">
                  <span>Fecha</span><span className="text-center">Vistas</span><span className="text-center">Carrito</span><span className="text-center">Inicio</span><span className="text-center">Pedidos</span>
                </div>
                {stats.funnelDaily.map((day) => (
                  <div key={day.date} className="grid grid-cols-5 gap-2 border-b px-3 py-2 text-xs last:border-0">
                    <span>{day.date}</span><span className="text-center">{day.product_view}</span><span className="text-center">{day.add_to_cart}</span><span className="text-center">{day.checkout_started}</span><span className="text-center">{day.order_created}</span>
                  </div>
                ))}
              </div>
            )}
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
