'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { useCartStore } from '@/stores/cart-store'
import { formatPrice, convertDriveUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from './empty-state'
import { ShoppingBag, Minus, Plus, Trash2, Loader2, MapPin, TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
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

export function CartView() {
  const { navigate, campaignFilter, setCampaignFilter } = useAppStore()
  const { items, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [deletingProductName, setDeletingProductName] = useState('')
  const [form, setForm] = useState({ name: '', city: '', phone: '', address: '', location: '', observations: '' })
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const queryClient = useQueryClient()

  const subtotal = getTotal()
  const { data: pricing, isFetching: pricingLoading } = useQuery({
    queryKey: ['cart-pricing', subtotal, couponCode],
    queryFn: async () => {
      const response = await fetch('/api/discount/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subtotal, code: couponCode }) })
      if (!response.ok) throw new Error('No se pudo calcular el descuento')
      return response.json() as Promise<{ subtotal: number; percent: number; amount: number; total: number; source: string | null; coupon: string | null; couponError?: string }>
    },
    enabled: subtotal > 0,
  })
  const total = pricing?.total ?? subtotal

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return toast.error('Ingresa un código de cupón')
    setCouponCode(code)
  }

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = items.find((i) => (i.itemKey || i.productId) === productId)
    if (!item) return
    updateQuantity(productId, item.quantity + delta)
  }

  const openOrderDialog = () => {
    if (items.length === 0) return
    setOrderDialogOpen(true)
  }

  const confirmDeleteItem = (productId: string, productName: string) => {
    setDeletingProductId(productId)
    setDeletingProductName(productName)
    setDeleteDialogOpen(true)
  }

  const executeDeleteItem = () => {
    if (deletingProductId) {
      removeItem(deletingProductId)
      toast.success('Producto eliminado del carrito')
    }
    setDeleteDialogOpen(false)
    setDeletingProductId(null)
    setDeletingProductName('')
  }

  const handleSubmitOrder = async () => {
    if (!form.name.trim() || !form.city.trim() || !form.phone.trim()) {
      toast.error('Por favor completa todos los campos obligatorios')
      return
    }
    if (!/^09\d{8}$/.test(form.phone.trim())) {
      toast.error('Ingresa un celular ecuatoriano válido: debe comenzar con 09 y tener 10 números')
      return
    }
    if (!form.address.trim() && !form.location) {
      toast.error('Escribe tu dirección de entrega o permite tomar tu ubicación actual')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name.trim(),
          customerCity: form.city.trim(),
          customerPhone: form.phone.trim(),
          customerAddress: form.address.trim(),
          customerLocation: form.location,
          observations: form.observations.trim(),
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            code: item.code,
            variantId: item.variantId,
            variantName: item.variantName,
          })),
          total,
          couponCode,
          campaignId: campaignFilter?.id || null,
        }),
      })

      if (!res.ok) {
        throw new Error('Error al crear pedido')
      }

      const order = await res.json()
      queryClient.invalidateQueries({ queryKey: ['orders'] })

      // Build WhatsApp message
      const date = new Date().toLocaleDateString('es-EC')
      const productList = items
        .map((item) => `🔸 ${item.quantity}x ${item.name}\n      ${item.code} — ${formatPrice(item.price * item.quantity)}`)
        .join('\n')

      const finalTotal = Number(order.total)
      const discountLine = order.discountPercent > 0 ? `\n🏷️ *Descuento:* ${order.discountPercent}% (${order.discountSource})` : ''
      const message = `✨ *NUEVO PEDIDO - FAMAR* ✨
━━━━━━━━━━━━━━━

👤 *Cliente:* ${form.name}
📍 *Ciudad:* ${form.city}
📱 *Teléfono:* ${form.phone}
🏠 *Dirección:* ${form.address || 'Ubicación compartida desde el dispositivo'}
📅 *Fecha:* ${date}
🧾 *Pedido:* #${order.orderNumber}
━━━━━━━━━━━━━━━
🛍️ *Productos:*
${productList}
━━━━━━━━━━━━━━━
💰 *TOTAL:* ${formatPrice(finalTotal)}${discountLine}
📝 *Observaciones:* ${form.observations || 'Ninguna'}`

      const encodedMessage = encodeURIComponent(message)
      window.open(`https://wa.me/593988215076?text=${encodedMessage}`, '_blank')

      toast.success('¡Pedido creado exitosamente!')
      clearCart()
      setCampaignFilter(null)
      setOrderDialogOpen(false)
      setForm({ name: '', city: '', phone: '', address: '', location: '', observations: '' })
    } catch {
      toast.error('Error al crear el pedido. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no permite obtener la ubicación. Escribe tu dirección manualmente.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = coords.latitude.toFixed(6)
        const longitude = coords.longitude.toFixed(6)
        setForm((current) => ({
          ...current,
          location: `https://maps.google.com/?q=${latitude},${longitude}`,
        }))
        setLocating(false)
        toast.success('Ubicación actual agregada al pedido')
      },
      () => {
        setLocating(false)
        toast.error('No pudimos obtener tu ubicación. Revisa el permiso o escribe tu dirección.')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState
          icon={<ShoppingBag className="h-16 w-16" />}
          title="Tu carrito está vacío"
          description="Explora nuestro catálogo y encuentra las joyas perfectas para ti."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('catalog')}
            >
              Ver catálogo
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carrito de Compras</h1>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
          <Trash2 className="h-4 w-4 mr-1" />
          Vaciar carrito
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="cart-items-scroll max-h-[56vh] space-y-3 overflow-y-auto pr-2 lg:col-span-2 lg:max-h-[calc(100vh-10rem)]">
          {items.map((item) => {
            const itemKey = item.itemKey || item.productId
            const imageUrl = item.mainImage ? convertDriveUrl(item.mainImage) : null
            return (
              <Card key={itemKey}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div
                      className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
                      onClick={() => {
                        useAppStore.getState().selectProduct(item.productId, item.code)
                        navigate('product-detail')
                      }}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <span className="text-2xl font-bold text-primary/40">
                            {item.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                        onClick={() => {
                          useAppStore.getState().selectProduct(item.productId, item.code)
                          navigate('product-detail')
                        }}
                      >
                        {item.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{item.code}</p>
                      {item.variantName && <p className="text-xs font-medium text-primary">Color: {item.variantName}</p>}
                      <p className="text-lg font-bold text-primary mt-1">
                        {formatPrice(item.price)}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(itemKey, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(itemKey, 1)}
                            disabled={item.quantity >= item.maxStock}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1"
                            onClick={() => confirmDeleteItem(itemKey, item.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Eliminar</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Summary */}
        <div>
          <Card className="lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <div className="cart-summary-scroll max-h-52 space-y-2 overflow-y-auto pr-2 lg:max-h-none lg:min-h-20 lg:flex-1">
                {items.map((item) => (
                  <div key={item.itemKey || item.productId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="coupon">Cupón de descuento</Label>
                <div className="flex gap-2"><Input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Ej: FAMAR10" /><Button type="button" variant="outline" onClick={applyCoupon} disabled={pricingLoading}><TicketPercent className="mr-1 h-4 w-4" />Aplicar</Button></div>
                {couponCode && pricing?.couponError ? <p className="text-xs text-destructive">{pricing.couponError}</p> : null}
                {pricing?.percent ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><div className="flex justify-between"><span>{pricing.source}</span><strong>-{pricing.percent}%</strong></div><div className="mt-1 flex justify-between text-muted-foreground"><span>Ahorro</span><span>-{formatPrice(pricing.amount)}</span></div></div> : null}
              </div>

              <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>

              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                onClick={openOrderDialog}
              >
                Solicitar Pedido
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Al solicitar, se abrirá WhatsApp para confirmar tu pedido
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Form Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completar Pedido</DialogTitle>
            <DialogDescription>
              Usa tus datos reales para que podamos contactarte y coordinar correctamente la entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Ingresa información real y verificable</p>
              <p className="mt-1 text-xs leading-relaxed">Usaremos estos datos únicamente para contactarte, confirmar el pedido y coordinar la entrega.</p>
            </div>
            <div>
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <Label htmlFor="city">Ciudad *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ej: Quito"
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Ej: 0991234567"
              />
              <p className="mt-1 text-xs text-muted-foreground">Debe comenzar con 09 y contener 10 números.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección de entrega *</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: ciudadela, calle principal, número de casa y referencia"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Si no conoces la dirección exacta, comparte la ubicación de tu dispositivo.</p>
              <Button type="button" variant="outline" className="w-full" onClick={captureCurrentLocation} disabled={locating}>
                {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                {locating ? 'Obteniendo ubicación...' : form.location ? 'Ubicación actual agregada ✓' : 'Tomar mi ubicación actual'}
              </Button>
            </div>
            <div>
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                placeholder="Referencias, horario preferido u otras instrucciones"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOrderDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSubmitOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar Pedido'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto del carrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deletingProductName}</strong> de tu carrito de compras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeDeleteItem}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
