'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { formatPrice, convertDriveUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search,
  Check,
  X,
  Eye,
  Loader2,
  Trash2,
  Pencil,
  Minus,
  Plus,
  Save,
  PackagePlus,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'

interface EditableOrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  name: string
  code: string
  image?: string | null
}

export function AdminOrdersView() {
  const { adminName } = useAuthStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = useState('')
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)

  // Edit state
  const [editItems, setEditItems] = useState<EditableOrderItem[]>([])
  const [editObs, setEditObs] = useState('')
  const [editName, setEditName] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editPhone, setEditPhone] = useState('')

  // Add product by code state
  const [codeSearch, setCodeSearch] = useState('')
  const [foundProduct, setFoundProduct] = useState<Record<string, unknown> | null>(null)
  const [searchingCode, setSearchingCode] = useState(false)
  const [codeError, setCodeError] = useState('')

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
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error confirming order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Pedido confirmado. Stock actualizado.')
      setDetailDialogOpen(false)
    },
    onError: (err) => toast.error(err.message || 'Error al confirmar el pedido'),
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({ status: 'cancelled', cancelReason: reason || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error cancelling order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Pedido cancelado')
      setDetailDialogOpen(false)
      setCancelDialogOpen(false)
      setCancelReasonInput('')
    },
    onError: (err) => toast.error(err.message || 'Error al cancelar el pedido'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error deleting order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Pedido eliminado permanentemente')
      setDetailDialogOpen(false)
      setDeleteDialogOpen(false)
      setSelectedOrder(null)
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar el pedido'),
  })

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return
      const total = editItems.reduce((sum, i) => sum + i.quantity * i.price, 0)
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({
          items: editItems,
          total,
          observations: editObs,
          customerName: editName,
          customerCity: editCity,
          customerPhone: editPhone,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error saving order')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Pedido modificado exitosamente')
      setEditDialogOpen(false)
      setDetailDialogOpen(false)
    },
    onError: (err) => toast.error(err.message || 'Error al guardar cambios'),
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

  const openEdit = (order?: Record<string, unknown>) => {
    const target = order || selectedOrder
    if (!target) return
    setSelectedOrder(target)
    const rawItems = target.items as Array<Record<string, unknown>> | undefined
    const items = (rawItems || []).map((item) => ({
      id: item.id as string,
      productId: item.productId as string,
      quantity: item.quantity as number,
      price: item.price as number,
      name: item.name as string,
      code: item.code as string,
      image: (item.product as { mainImage?: string } | null)?.mainImage || null,
    }))
    setEditItems(items)
    setEditObs((target.observations as string) || '')
    setEditName(target.customerName as string)
    setEditCity(target.customerCity as string)
    setEditPhone(target.customerPhone as string)
    setCodeSearch('')
    setFoundProduct(null)
    setCodeError('')
    setDetailDialogOpen(false)
    setEditDialogOpen(true)
  }

  const handleItemQtyChange = (itemId: string, delta: number) => {
    setEditItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    )
  }

  const handleRemoveItem = (itemId: string) => {
    setEditItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const searchProductByCode = async () => {
    const trimmed = codeSearch.trim().toUpperCase()
    if (!trimmed) {
      setCodeError('Ingresa un código de producto')
      setFoundProduct(null)
      return
    }
    setCodeError('')
    setFoundProduct(null)
    setSearchingCode(true)
    try {
      const res = await fetch(`/api/products?code=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.product) {
        setFoundProduct(data.product)
      } else {
        setCodeError(`No se encontró producto con código "${trimmed}"`)
      }
    } catch {
      setCodeError('Error al buscar producto')
    } finally {
      setSearchingCode(false)
    }
  }

  const addFoundProduct = () => {
    if (!foundProduct) return
    const product = foundProduct
    // Check if product is already in the order
    const existing = editItems.find((item) => item.productId === product.id)
    if (existing) {
      // Increase quantity
      setEditItems((prev) =>
        prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
      toast.success(`Cantidad de "${product.name}" aumentada a ${existing.quantity + 1}`)
    } else {
      const newItem: EditableOrderItem = {
        id: `new-${Date.now()}`,
        productId: product.id as string,
        quantity: 1,
        price: product.price as number,
        name: product.name as string,
        code: product.code as string,
      }
      setEditItems((prev) => [...prev, newItem])
      toast.success(`"${product.name}" agregado al pedido`)
    }
    setCodeSearch('')
    setFoundProduct(null)
  }

  const editTotal = editItems.reduce((sum, i) => sum + i.quantity * i.price, 0)

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
                      <TableCell>
                        {getStatusBadge(order.status as string)}
                        {(order.status as string) === 'cancelled' && (order.cancelReason as string) && (
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-[140px] truncate" title={order.cancelReason as string}>
                            {order.cancelReason as string}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.createdAt as string).toLocaleDateString('es-EC')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(order)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(order.status as string) === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(order)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
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
                  <div className="flex gap-1">
                    {(order.status as string) === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(order)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openDetail(order)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                  </div>
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

        {/* ========== Order Detail Dialog ========== */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Pedido #{selectedOrder?.orderNumber}</DialogTitle>
              <DialogDescription>
                Detalles del pedido del cliente
              </DialogDescription>
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

                {(selectedOrder.status as string) === 'cancelled' && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                    <span className="text-xs text-muted-foreground">Motivo de cancelación:</span>
                    <p className="text-sm">{(selectedOrder.cancelReason as string) || 'Sin motivo registrado'}</p>
                  </div>
                )}

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
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const img = (item.product as { mainImage?: string } | null)?.mainImage
                                    const url = img ? convertDriveUrl(img) : null
                                    return url ? (
                                      <img
                                        src={url}
                                        alt={item.name as string}
                                        className="h-11 w-11 rounded-md object-cover shrink-0 cursor-zoom-in hover:scale-110 transition-transform"
                                        loading="lazy"
                                        onClick={(e) => { e.stopPropagation(); setZoomImage(url) }}
                                      />
                                    ) : (
                                      <div className="h-11 w-11 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">—</div>
                                    )
                                  })()}
                                  <div className="min-w-0">
                                    <p className="font-medium truncate max-w-[150px]">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.code}</p>
                                  </div>
                                </div>
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

                {/* Action buttons */}
                <div className="space-y-3 pt-2">
                  {(selectedOrder.status as string) === 'pending' && (
                    <>
                      <div className="flex gap-3">
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
                          onClick={() => {
                            setCancellingOrderId(selectedOrder.id as string)
                            setCancelReasonInput('')
                            setCancelDialogOpen(true)
                          }}
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
                      <Separator />
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => openEdit()}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Modificar Pedido
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                  {(selectedOrder.status as string) !== 'pending' && (
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Pedido
                    </Button>
                  )}
                </div>
              </>
            )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ========== Edit Order Dialog ========== */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Modificar Pedido #{selectedOrder?.orderNumber}</DialogTitle>
              <DialogDescription>
                Cambia cantidades, elimina productos o edita los datos del cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto space-y-4">
              {/* Customer info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-name">Cliente</Label>
                  <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-city">Ciudad</Label>
                  <Input id="edit-city" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Teléfono</Label>
                  <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
              </div>

              <Separator />

              {/* Editable items */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Productos</h4>
                {editItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay productos en el pedido</p>
                ) : (
                  <div className="space-y-2">
                    {editItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                        {item.image ? (
                          <img
                            src={convertDriveUrl(item.image)}
                            alt={item.name}
                            className="h-10 w-10 rounded-md object-cover shrink-0 cursor-zoom-in hover:scale-110 transition-transform"
                            loading="lazy"
                            onClick={() => setZoomImage(convertDriveUrl(item.image as string))}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-background flex items-center justify-center text-[10px] text-muted-foreground shrink-0">—</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.code} · {formatPrice(item.price)} c/u</p>
                        </div>
                        <div className="flex items-center border rounded-md">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleItemQtyChange(item.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleItemQtyChange(item.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-bold w-16 text-right shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Add product by code */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <PackagePlus className="h-4 w-4" />
                  Agregar producto por código
                </h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: FAM-AN001"
                    value={codeSearch}
                    onChange={(e) => { setCodeSearch(e.target.value); setCodeError(''); setFoundProduct(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchProductByCode() } }}
                    className="flex-1 uppercase font-mono text-sm"
                    disabled={searchingCode}
                  />
                  <Button
                    variant="outline"
                    onClick={searchProductByCode}
                    disabled={searchingCode || !codeSearch.trim()}
                    className="shrink-0"
                  >
                    {searchingCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Error message */}
                {codeError && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                {/* Found product */}
                {foundProduct && (
                  <div className="mt-2 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{foundProduct.name as string}</p>
                        <p className="text-xs text-muted-foreground">
                          {foundProduct.code as string} · Stock: {foundProduct.stock as number} · {formatPrice(foundProduct.price as number)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={addFoundProduct}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Observations */}
              <div>
                <Label htmlFor="edit-obs">Observaciones</Label>
                <Textarea id="edit-obs" value={editObs} onChange={(e) => setEditObs(e.target.value)} rows={2} />
              </div>

              {/* Total */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                <span className="font-semibold">Nuevo Total</span>
                <span className="text-xl font-bold text-primary">{formatPrice(editTotal)}</span>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => saveEditMutation.mutate()}
                  disabled={saveEditMutation.isPending || editItems.length === 0}
                >
                  {saveEditMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Guardar Cambios</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========== Image Zoom ========== */}
        <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
          <DialogContent className="max-w-lg p-0 overflow-hidden bg-background/95 border-primary/30">
            {zoomImage && (
              <img
                src={zoomImage}
                alt="Producto"
                className="w-full max-h-[75vh] object-contain bg-black/30"
                onClick={() => setZoomImage(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* ========== Cancel Order with Reason ========== */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar pedido</DialogTitle>
              <DialogDescription>
                Anota el motivo para tenerlo registrado en el análisis de cancelaciones.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Motivo de cancelación</Label>
              <Textarea
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Ej: cliente no respondió, se arrepintió, sin stock, precio..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Volver</Button>
              <Button
                variant="destructive"
                onClick={() => cancellingOrderId && cancelMutation.mutate({ orderId: cancellingOrderId, reason: cancelReasonInput })}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</>
                ) : (
                  'Cancelar pedido'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========== Delete Order Confirmation ========== */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar pedido #{selectedOrder?.orderNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el pedido permanentemente.
                {selectedOrder?.status === 'confirmed' && (
                  <span className="block mt-1 font-medium text-amber-600 dark:text-amber-400">
                    El stock de los productos será restaurado automáticamente.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (selectedOrder) deleteMutation.mutate(selectedOrder.id as string)
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}