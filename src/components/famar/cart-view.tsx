'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { useCartStore, type CartItem } from '@/stores/cart-store'
import { formatPrice, convertDriveUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from './empty-state'
import { ShoppingBag, Minus, Plus, Trash2, Loader2, MapPin, TicketPercent, MessageCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { salePrice } from '@/lib/pricing'
import { usePricingSettings } from '@/hooks/use-pricing-settings'
import { trackStoreEvent } from '@/lib/track-store-event'
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

const RECEIPT_KEY = 'famar-whatsapp-receipt'
type WhatsAppReceipt = { orderNumber: string; total: number; message: string; createdAt: number; campaignId?: string }
function receiptUrl(message: string) {
  const url = new URL('https://api.whatsapp.com/send')
  url.searchParams.set('phone', '593988215076')
  url.searchParams.set('text', message)
  return url.toString()
}

export function CartView() {
  const { navigate, campaignFilter, setCampaignFilter } = useAppStore()
  const { items, replaceItems, removeItem, updateQuantity, clearCart } = useCartStore()
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [deletingProductName, setDeletingProductName] = useState('')
  const [form, setForm] = useState({ name: '', city: '', phone: '', address: '', location: '', observations: '' })
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [receipt, setReceipt] = useState<WhatsAppReceipt | null>(null)
  const [locating, setLocating] = useState(false)
  const [couponInput, setCouponInput] = useState(() => campaignFilter?.couponCode?.toUpperCase() || '')
  const [couponCode, setCouponCode] = useState('')
  const queryClient = useQueryClient()
  const { saleDiscount } = usePricingSettings()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null')
        if (saved && typeof saved.orderNumber === 'string' && typeof saved.message === 'string' && Number.isFinite(saved.total) && Number.isFinite(saved.createdAt) && Date.now() - saved.createdAt < 86400000) setReceipt(saved)
        else sessionStorage.removeItem(RECEIPT_KEY)
      } catch { /* El envío sigue disponible aunque el navegador bloquee el almacenamiento. */ }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    trackStoreEvent('cart_view', { campaignId: campaignFilter?.id })
  }, [campaignFilter?.id])

  const { data: campaignValidation } = useQuery({
    queryKey: ['campaign-validation', campaignFilter?.id],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns?validate=${encodeURIComponent(campaignFilter?.id || '')}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo validar la promoción')
      return response.json() as Promise<{ campaignValid: boolean; couponValid: boolean; coupon: { code: string; discount: number } | null }>
    },
    enabled: Boolean(campaignFilter?.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!campaignFilter || !campaignValidation) return
    if (!campaignValidation.campaignValid) {
      setCampaignFilter(null)
      return
    }
    if (campaignFilter.couponCode && !campaignValidation.couponValid) {
      setCampaignFilter({ id: campaignFilter.id, title: campaignFilter.title })
      const timer = window.setTimeout(() => {
        setCouponInput('')
        setCouponCode('')
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [campaignFilter, campaignValidation, setCampaignFilter])

  const cartIdentity = items.map((item) => `${item.productId}:${item.variantId || ''}`).join('|')
  const { data: cartValidation, isFetching: cartUpdating } = useQuery({
    queryKey: ['cart-validation', cartIdentity],
    queryFn: async () => {
      const response = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, variantId: item.variantId })),
        }),
      })
      if (!response.ok) throw new Error('No se pudo actualizar el carrito')
      return response.json() as Promise<{ items: Array<{ productId: string; variantId: string | null; available: boolean; code?: string; name?: string; price?: number; isOnSale?: boolean; mainImage?: string; maxStock?: number; variantName?: string | null }> }>
    },
    enabled: items.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!cartValidation) return
    let unavailable = 0
    let adjusted = 0
    let pricingChanged = 0
    const validated = new Map(cartValidation.items.map((item) => [`${item.productId}:${item.variantId || ''}`, item]))
    const nextItems: CartItem[] = items.map((item) => {
      const current = validated.get(`${item.productId}:${item.variantId || ''}`)
      if (!current) return { ...item, unavailable: true, maxStock: 0 }
      const maxStock = Number(current.maxStock || 0)
      const isUnavailable = !current.available || maxStock <= 0
      const quantity = isUnavailable ? item.quantity : Math.min(item.quantity, maxStock)
      if (isUnavailable && !item.unavailable) unavailable += 1
      if (quantity !== item.quantity) adjusted += 1
      if (item.price !== current.price || Boolean(item.isOnSale) !== Boolean(current.isOnSale)) pricingChanged += 1
      return {
        ...item,
        code: current.code || item.code,
        name: current.name || item.name,
        price: Number(current.price),
        isOnSale: Boolean(current.isOnSale),
        unavailable: isUnavailable,
        mainImage: current.mainImage || item.mainImage,
        maxStock,
        quantity,
        variantName: current.variantName || item.variantName,
      }
    })
    const availabilityChanged = nextItems.some((item, index) => item.unavailable !== items[index]?.unavailable)
    if (!availabilityChanged && !adjusted && !pricingChanged) return
    replaceItems(nextItems)
    if (unavailable) toast.warning(`${unavailable} producto${unavailable === 1 ? '' : 's'} de tu carrito ya está${unavailable === 1 ? '' : 'n'} agotado${unavailable === 1 ? '' : 's'}`)
    if (adjusted) toast.info('Actualizamos cantidades según el stock disponible')
    if (pricingChanged) toast.info('Actualizamos los precios y promociones del carrito')
  }, [cartValidation, items, replaceItems])

  const priceForItem = (item: (typeof items)[number]) => salePrice(item.price, Boolean(item.isOnSale), saleDiscount)
  const { eligibleSubtotal, saleBaseSubtotal, saleSubtotal } = items.reduce((totals, item) => {
    if (item.unavailable) return totals
    if (item.isOnSale) {
      totals.saleBaseSubtotal += item.price * item.quantity
      totals.saleSubtotal += priceForItem(item) * item.quantity
    } else {
      totals.eligibleSubtotal += item.price * item.quantity
    }
    return totals
  }, { eligibleSubtotal: 0, saleBaseSubtotal: 0, saleSubtotal: 0 })
  const subtotal = eligibleSubtotal + saleSubtotal
  const { data: pricing, isFetching: pricingLoading } = useQuery({
    queryKey: ['cart-pricing', eligibleSubtotal, saleSubtotal, couponCode, saleDiscount],
    queryFn: async () => {
      const response = await fetch('/api/discount/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eligibleSubtotal, saleBaseSubtotal, saleSubtotal, code: couponCode }) })
      if (!response.ok) throw new Error('No se pudo calcular el descuento')
      return response.json() as Promise<{ subtotal: number; eligibleSubtotal: number; saleSubtotal: number; percent: number; amount: number; total: number; source: string | null; coupon: string | null; validCoupon?: string | null; couponError?: string }>
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
    if (cartUpdating) return toast.info('Estamos actualizando precios y disponibilidad. Espera un momento.')
    if (items.some((item) => item.unavailable)) return toast.error('Retira los productos agotados antes de solicitar el pedido.')
    trackStoreEvent('checkout_started', { campaignId: campaignFilter?.id })
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
    if (submittingRef.current) return
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

    submittingRef.current = true
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
            price: priceForItem(item),
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
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Error al crear el pedido')
      }

      const order = await res.json()
      trackStoreEvent('order_created', { campaignId: campaignFilter?.id })
      queryClient.invalidateQueries({ queryKey: ['orders'] })

      // Build WhatsApp message
      const date = new Date().toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' })
      const productList = (order.items as Array<{ quantity: number; name: string; code: string; price: number; variantName?: string | null }>)
        .map((item) => `\u{1F538} ${item.quantity}x ${item.name}${item.variantName ? ` (${item.variantName})` : ''}\n      ${item.code} — ${formatPrice(item.price * item.quantity)}`)
        .join('\n')

      const finalTotal = Number(order.total)
      const orderSubtotal = Number(order.subtotal ?? finalTotal)
      const discountAmount = Number(order.discountAmount || 0)
      const discountPercent = Number(order.discountPercent || 0)
      const discountSource = String(order.discountSource || '')
      const discountDetails = discountPercent > 0
        ? discountSource.startsWith('Cupón ')
          ? `\n\u{1F39F}\u{FE0F} *Cupón aplicado:* ${discountSource.slice(6)} (-${discountPercent}%)\n\u{1F49A} *Ahorro:* -${formatPrice(discountAmount)}`
          : `\n\u{1F3F7}\u{FE0F} *${discountSource || 'Descuento'}:* -${discountPercent}%\n\u{1F49A} *Ahorro:* -${formatPrice(discountAmount)}`
        : ''
      const message = `\u{2728} *NUEVO PEDIDO - FAMAR* \u{2728}
━━━━━━━━━━━━━━━

\u{1F464} *Cliente:* ${form.name}
\u{1F4CD} *Ciudad:* ${form.city}
\u{1F4F1} *Teléfono:* ${form.phone}
\u{1F3E0} *Dirección:* ${form.address || 'Ubicación compartida desde el dispositivo'}
\u{1F4C5} *Fecha:* ${date}
\u{1F9FE} *Pedido:* #${order.orderNumber}
━━━━━━━━━━━━━━━
\u{1F6CD}\u{FE0F} *Productos:*
${productList}
━━━━━━━━━━━━━━━
\u{1F4B5} *Subtotal:* ${formatPrice(orderSubtotal)}${discountDetails}
\u{1F4B0} *TOTAL FINAL:* ${formatPrice(finalTotal)}
\u{1F4DD} *Observaciones:* ${form.observations || 'Ninguna'}`

      const savedReceipt = { orderNumber: String(order.orderNumber), total: finalTotal, message, createdAt: Date.now(), campaignId: campaignFilter?.id }
      setReceipt(savedReceipt)
      try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(savedReceipt)) } catch { /* Mantener el comprobante en memoria. */ }
      clearCart()
      setCampaignFilter(null)
      setOrderDialogOpen(false)
      setForm({ name: '', city: '', phone: '', address: '', location: '', observations: '' })
      // Keep the receipt available when returning, or if the device cannot open WhatsApp.
      try {
        trackStoreEvent('whatsapp_opened', { campaignId: savedReceipt.campaignId })
        window.location.assign(receiptUrl(message))
      } catch {
        toast.info('Tu pedido está guardado. Pulsa el botón de WhatsApp para enviarlo.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear el pedido. Intenta de nuevo.')
    } finally {
      submittingRef.current = false
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

  if (items.length === 0 && receipt) {
    return <div className="container mx-auto max-w-lg px-4 py-10">
      <Card><CardHeader className="text-center">
        <MessageCircle className="mx-auto mb-2 h-10 w-10 text-primary" />
        <CardTitle>¡Tu pedido está registrado!</CardTitle>
        <p className="allow-text-selection text-sm text-muted-foreground">#{receipt.orderNumber} · {formatPrice(receipt.total)}</p>
      </CardHeader><CardContent className="space-y-4 text-center">
        <p className="text-sm font-medium">Solo falta tocar Enviar en WhatsApp.</p>
        <Button asChild className="h-auto min-h-12 w-full whitespace-normal py-3 text-base">
          <a href={receiptUrl(receipt.message)} target="_blank" rel="noopener noreferrer" onClick={() => trackStoreEvent('whatsapp_opened', { campaignId: receipt.campaignId })}><MessageCircle className="mr-2 h-5 w-5 shrink-0" />Enviar pedido por WhatsApp</a>
        </Button>
        <p className="text-xs text-muted-foreground">¿No abrió WhatsApp? Usa el botón de arriba. Si ya enviaste el mensaje, te responderemos por ese chat.</p>
        <Button variant="outline" className="w-full" onClick={async () => {
          try { await navigator.clipboard.writeText(receipt.message); toast.success('Mensaje copiado. Pégalo en nuestro chat de WhatsApp.') }
          catch { toast.error('No se pudo copiar. Usa el botón de WhatsApp.') }
        }}><Copy className="mr-2 h-4 w-4" />Copiar mensaje</Button>
        <Button variant="ghost" onClick={() => navigate('catalog')}>Seguir viendo el catálogo</Button>
      </CardContent></Card>
    </div>
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
                      {item.unavailable && <p className="mt-1 text-xs font-semibold text-destructive">Agotado · Retíralo para continuar con el pedido</p>}
                      <p className="text-lg font-bold text-primary mt-1">
                        {item.isOnSale && <span className="mr-1 text-xs font-normal text-muted-foreground line-through">{formatPrice(item.price)}</span>}
                        {formatPrice(priceForItem(item))}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(itemKey, -1)}
                            disabled={item.unavailable}
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
                            disabled={item.unavailable || item.quantity >= item.maxStock}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {formatPrice(priceForItem(item) * item.quantity)}
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
                    <span className={item.unavailable ? 'shrink-0 font-medium text-destructive' : 'shrink-0'}>
                      {item.unavailable ? 'Agotado' : formatPrice(priceForItem(item) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="coupon">Cupón de descuento</Label>
                <p className="text-xs text-muted-foreground">Se aplica únicamente a productos sin oferta.</p>
                {campaignFilter?.couponCode && campaignValidation?.couponValid && !pricing?.coupon && <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs"><strong className="text-foreground">Tu publicidad incluye {campaignFilter.couponCode}</strong><p className="mt-0.5 text-muted-foreground">Recuerda aplicarlo para recibir {campaignFilter.couponDiscount || ''}% de descuento en productos sin oferta.</p></div><Button type="button" size="sm" onClick={() => { setCouponInput(campaignFilter.couponCode || ''); setCouponCode((campaignFilter.couponCode || '').toUpperCase()) }} disabled={pricingLoading}>Aplicar cupón</Button></div>}
                <div className="flex gap-2"><Input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Ej: FAMAR10" disabled={pricingLoading} /><Button type="button" variant="outline" onClick={applyCoupon} disabled={pricingLoading}>{pricingLoading && couponCode ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-1 h-4 w-4" />}{pricingLoading && couponCode ? 'Aplicando…' : 'Aplicar'}</Button></div>
                {couponCode && pricingLoading ? <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Estamos validando tu cupón. Espera un momento…</span></div> : null}
                {couponCode && !pricingLoading && pricing?.couponError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><strong>El cupón no se aplicó.</strong><p className="mt-1">{pricing.couponError}</p></div> : null}
                {couponCode && !pricingLoading && pricing?.coupon && !pricing.couponError ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500"><strong>¡Cupón aplicado correctamente!</strong><p className="mt-1">El descuento ya está incluido en el total de tu pedido.</p></div> : null}
                {couponCode && !pricingLoading && pricing?.validCoupon && !pricing.coupon && !pricing.couponError ? <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Tu cupón es válido.</strong><p className="mt-1">Ya tienes un descuento igual o mayor, por eso conservamos automáticamente el que más te beneficia.</p></div> : null}
              </div>

              {saleSubtotal > 0 && <div className="space-y-2 rounded-lg bg-destructive/5 p-3 text-sm"><div className="flex justify-between"><span>Productos sin oferta</span><span>{formatPrice(eligibleSubtotal)}</span></div><div className="flex justify-between text-destructive"><span>Ofertas ({saleDiscount}% incluido)</span><span>{formatPrice(saleSubtotal)}</span></div></div>}
              <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              {pricing?.percent ? <div className="flex justify-between text-sm"><span>{pricing.source}</span><strong className="text-primary">-{formatPrice(pricing.amount)}</strong></div> : null}

              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                onClick={openOrderDialog}
                disabled={cartUpdating || items.some((item) => item.unavailable)}
              >
                {cartUpdating ? 'Actualizando carrito…' : items.some((item) => item.unavailable) ? 'Retira los productos agotados' : 'Solicitar Pedido'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Abriremos WhatsApp con tu pedido listo para enviar. <button type="button" onClick={() => navigate('policies')} className="text-primary hover:underline">Políticas de compra</button>.
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
              Ingresa tus datos reales para confirmar el pedido y coordinar la entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                autoComplete="tel-national"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Ej: 0991234567"
              />
              <p className="mt-1 text-xs text-muted-foreground">Debe comenzar con 09 y contener 10 números.</p>
              {/^09\d{8}$/.test(form.phone) && <p className="mt-2 rounded-md bg-primary/10 p-2 text-sm">¿Este es tu WhatsApp? <strong className="allow-text-selection whitespace-nowrap">{form.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</strong> <button type="button" className="text-primary underline" onClick={() => document.getElementById('phone')?.focus()}>Corregir</button></p>}
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
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
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
                    Preparando pedido…
                  </>
                ) : (
                  <><MessageCircle className="mr-2 h-4 w-4 shrink-0" />Pedir por WhatsApp</>
                )}
              </Button>
            </div>
            <p className="text-center text-[11px] leading-5 text-muted-foreground">Al confirmar declaras que revisaste los productos y aceptas las <button type="button" onClick={() => { setOrderDialogOpen(false); navigate('policies') }} className="text-primary hover:underline">políticas de compra y privacidad</button>.</p>
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
