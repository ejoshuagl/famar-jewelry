'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Check,
  X,
  Eye,
  Loader2,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminOrdersView() {
  const { adminName } = useAuthStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
        page: page.toString(),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/orders?${params}`, {
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) throw new Error('Unauthorized')
      return res.json()
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      if (!res.ok) throw new Error('Error confirming order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      toast.success('Pedido confirmado. Stock actualizado.')
      setDetailDialogOpen(false)
    },
    onError: () => toast.error('Error al confirmar el pedido'),
  })

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Error cancelling order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      toast.success('Pedido cancelado')
      setDetailDialogOpen(false)
    },
    onError: () => toast.error('Error al cancelar el pedido'),
  })

  const orders = data?.orders || []
  const totalPages = data?.totalPages || 1

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      confirmed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    }
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  const openDetail = (order: Record<string, unknown>) => {
    setSelectedOrder(order)
    setDetailDialogOpen(true)
  }

  return (
    <div className="space-y-4">
        <h1 className="text-xl font-bold">Pedidos</h1>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o #pedido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Table */}
        <Card className="hidden lg:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron pedidos
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order: Record<string, unknown>) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">#{order.orderNumber}</TableCell>
                      <TableCell className="text-sm">{order.customerName}</TableCell>
                      <TableCell className="text-sm">{order.customerCity}</TableCell>
                      <TableCell className="text-sm">{order.customerPhone}</TableCell>
                      <TableCell className="text-sm font-medium">{formatPrice(order.total as number)}</TableCell>
                      <TableCell>{getStatusBadge(order.status as string)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.createdAt as string).toLocaleDateString('es-EC')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(order)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3">
                <div className="flex justify-between mb-2">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse mb-1" />
                <div className="flex justify-between mt-3">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </Card>
            ))
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron pedidos
            </div>
          ) : (
            orders.map((order: Record<string, unknown>) => (
              <Card key={order.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">#{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground truncate">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.customerCity}</p>
                  </div>
                  {getStatusBadge(order.status as string)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-base font-bold">{formatPrice(order.total as number)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt as string).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDetail(order)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Ver
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                variant={page === i + 1 ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto space-y-4">
            {selectedOrder && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ciudad:</span>
                    <p className="font-medium">{selectedOrder.customerCity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <p className="font-medium">{selectedOrder.customerPhone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>
                    <p className="font-medium">{new Date(selectedOrder.createdAt as string).toLocaleString('es-EC')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estado:</span>
                    <div className="mt-1">{getStatusBadge(selectedOrder.status as string)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Productos</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="text-left px-3 py-2 whitespace-nowrap">Producto</th>
                            <th className="text-center px-3 py-2 whitespace-nowrap">Cant</th>
                            <th className="text-right px-3 py-2 whitespace-nowrap">Precio</th>
                            <th className="text-right px-3 py-2 whitespace-nowrap">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedOrder.items as Array<Record<string, unknown>>).map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-3 py-2">
                                <p className="font-medium truncate max-w-[150px]">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.code}</p>
                              </td>
                              <td className="text-center px-3 py-2">{item.quantity}</td>
                              <td className="text-right px-3 py-2 whitespace-nowrap">{formatPrice(item.price as number)}</td>
                              <td className="text-right px-3 py-2 font-medium whitespace-nowrap">
                                {formatPrice((item.price as number) * (item.quantity as number))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/50">
                            <td colSpan={3} className="text-right px-3 py-2 font-bold">Total</td>
                            <td className="text-right px-3 py-2 font-bold text-primary whitespace-nowrap">
                              {formatPrice(selectedOrder.total as number)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {selectedOrder.observations && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Observaciones</h4>
                    <p className="text-sm text-muted-foreground">{selectedOrder.observations}</p>
                  </div>
                )}

                {(selectedOrder.status as string) === 'pending' && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-green-600 text-white hover:bg-green-700"
                      onClick={() => confirmMutation.mutate(selectedOrder.id as string)}
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Confirmar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => cancelMutation.mutate(selectedOrder.id as string)}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Cancelar
                    </Button>
                  </div>
                )}
              </>
            )}
            </div>
          </DialogContent>
        </Dialog>
    </div>
  )
}