'use client'

import { useEffect, useState } from 'react'
import { Loader2, Minus, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'
import { parseVariants } from '@/lib/product-variants'
import { salePrice } from '@/lib/pricing'
import { useAuthStore } from '@/stores/auth-store'

type ProductResult = {
  id: string
  code: string
  name: string
  price: number
  stock: number
  isOnSale: boolean
  variants?: unknown
}

type ManualItem = {
  key: string
  productId: string
  code: string
  name: string
  price: number
  quantity: number
  available: number
  isOnSale: boolean
  variantId?: string
  variantName?: string
}

export function AdminCreateOrderDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const can = useAuthStore((s) => s.can)
  const [customerCity, setCustomerCity] = useState('Babahoyo')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [observations, setObservations] = useState('')
  const [applyWholesaleDiscount, setApplyWholesaleDiscount] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResult[]>([])
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({})
  const [items, setItems] = useState<ManualItem[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saleDiscount, setSaleDiscount] = useState(25)
  const [quote, setQuote] = useState<{ key: string; total: number; amount: number; percent: number; source: string | null; couponError?: string; tiers: Array<{ min: number; discount: number }> } | null>(null)
  const [quoteError, setQuoteError] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/commerce-settings', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (Number.isFinite(Number(data?.saleDiscount))) setSaleDiscount(Number(data.saleDiscount))
      })
      .catch(() => undefined)
  }, [open])

  const reset = () => {
    setCustomerName(''); setCustomerCity('Babahoyo'); setCustomerPhone(''); setCustomerAddress(''); setObservations('')
    setApplyWholesaleDiscount(false); setCouponCode(''); setQuery(''); setResults([]); setVariantChoice({}); setItems([])
  }

  const close = (next: boolean) => {
    if (!next && !saving) reset()
    onOpenChange(next)
  }

  const searchProducts = async () => {
    if (!query.trim()) return toast.error('Escribe un nombre o código')
    setSearching(true)
    try {
      const params = new URLSearchParams({ all: 'true', compact: 'true', flag: 'available', limit: '20', search: query.trim() })
      const response = await fetch(`/api/products?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudieron buscar productos')
      const data = await response.json()
      setResults(data.products || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron buscar productos')
    } finally {
      setSearching(false)
    }
  }

  const addProduct = (product: ProductResult) => {
    const variants = parseVariants(product.variants)
    const variantId = variants.length ? variantChoice[product.id] : undefined
    const variant = variants.find((entry) => entry.id === variantId)
    if (variants.length && !variant) return toast.error('Selecciona una variante')
    const available = variant?.stock ?? product.stock
    if (available < 1) return toast.error('Esa opción está agotada')
    const key = `${product.id}:${variantId || ''}`
    const existing = items.find((item) => item.key === key)
    if (existing) {
      if (existing.quantity >= available) return toast.error('No hay más unidades disponibles')
      setItems(items.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setItems([...items, { key, productId: product.id, code: product.code, name: product.name, price: product.price, quantity: 1, available, isOnSale: product.isOnSale, variantId, variantName: variant?.name }])
    }
  }

  const changeQuantity = (key: string, delta: number) => {
    setItems(items.flatMap((item) => {
      if (item.key !== key) return [item]
      const quantity = item.quantity + delta
      if (quantity < 1) return []
      return [{ ...item, quantity: Math.min(quantity, item.available) }]
    }))
  }

  const normalSubtotal = items.filter((item) => !item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
  const offerSubtotal = items.filter((item) => item.isOnSale).reduce((sum, item) => sum + salePrice(item.price, true, saleDiscount) * item.quantity, 0)
  const subtotal = normalSubtotal + offerSubtotal
  const quoteKey = JSON.stringify([normalSubtotal, offerSubtotal, couponCode.trim(), applyWholesaleDiscount])
  const needsQuote = items.length > 0 && (applyWholesaleDiscount || Boolean(couponCode.trim()))
  const currentQuote = quote?.key === quoteKey ? quote : null
  const calculating = needsQuote && !currentQuote && !quoteError
  const nextTier = currentQuote?.tiers.filter((tier) => tier.discount > 0 && tier.min > normalSubtotal).sort((a, b) => a.min - b.min)[0]

  useEffect(() => {
    if (!open || !needsQuote) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setQuoteError('')
      try {
        const [eligibleSubtotal, saleSubtotal, code, includeWholesale] = JSON.parse(quoteKey)
        const response = await fetch('/api/discount/validate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eligibleSubtotal, saleSubtotal, code, includeWholesale }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('No se pudo calcular el descuento. Modifica el pedido para reintentar.')
        const data = await response.json()
        if (!controller.signal.aborted) setQuote({ ...data, key: quoteKey })
      } catch (error) {
        if (!controller.signal.aborted) setQuoteError(error instanceof Error ? error.message : 'No se pudo calcular el total')
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, needsQuote, quoteKey])

  const save = async () => {
    if (!customerName.trim() || !customerCity.trim()) return toast.error('Completa el nombre y la ciudad')
    if (!/^09\d{8}$/.test(customerPhone.trim())) return toast.error('Ingresa un número celular válido')
    if (!items.length) return toast.error('Agrega al menos un producto')
    setSaving(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualOrder: true,
          applyWholesaleDiscount,
          couponCode: couponCode.trim(),
          customerName,
          customerCity,
          customerPhone,
          customerAddress,
          observations,
          items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el pedido')
      toast.success(`Pedido #${data.orderNumber} creado por ${formatPrice(data.total)}`)
      reset(); onOpenChange(false); onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el pedido')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nuevo pedido manual</DialogTitle>
        <DialogDescription>Para ventas recibidas por revista, teléfono u otro medio. Las ofertas activas siempre se respetan; mayorista es opcional.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Cliente *</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
          <div><Label>Teléfono *</Label><Input inputMode="numeric" maxLength={10} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, ''))} placeholder="09XXXXXXXX" /></div>
          <div><Label>Ciudad *</Label><Input value={customerCity} onChange={(event) => setCustomerCity(event.target.value)} /></div>
          <div><Label>Dirección (opcional)</Label><Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} /></div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-4">
            <div><Label>Aplicar descuento mayorista</Label><p className="text-xs text-muted-foreground">El mínimo se calcula solo con productos sin oferta.</p></div>
            <Switch disabled={!can('orders:wholesale')} checked={applyWholesaleDiscount} onCheckedChange={setApplyWholesaleDiscount} />
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <Label htmlFor="manual-coupon">Cupón de descuento (opcional)</Label>
          <Input disabled={!can('orders:coupon')} id="manual-coupon" className="mt-1 uppercase" maxLength={50} value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Ejemplo: CLIENTE10" />
          <p className="mt-1 text-xs text-muted-foreground">Si también habilitas mayorista, se usará solamente el descuento más conveniente.</p>
        </div>

        <div>
          <Label>Buscar productos</Label>
          <div className="mt-1 flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchProducts() }} placeholder="Nombre o código" /><Button type="button" variant="outline" onClick={searchProducts} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div>
          {results.length ? <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border p-2">{results.map((product) => {
            const variants = parseVariants(product.variants).filter((variant) => variant.stock > 0)
            return <div key={product.id} className="grid gap-2 rounded-md bg-muted/25 p-2 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.code} · {product.isOnSale ? <><span className="line-through">{formatPrice(product.price)}</span> <span className="text-destructive">{formatPrice(salePrice(product.price, true, saleDiscount))} (oferta)</span></> : formatPrice(product.price)} · Stock {product.stock}</p></div>
              {variants.length ? <Select value={variantChoice[product.id] || ''} onValueChange={(value) => setVariantChoice({ ...variantChoice, [product.id]: value })}><SelectTrigger className="h-8"><SelectValue placeholder="Elegir variante" /></SelectTrigger><SelectContent>{variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name} · {variant.stock}</SelectItem>)}</SelectContent></Select> : <span />}
              <Button type="button" size="sm" onClick={() => addProduct(product)}><PackagePlus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
            </div>
          })}</div> : null}
        </div>

        <div className="space-y-2">
          <Label>Productos del pedido</Label>
          {!items.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Todavía no has agregado productos.</div> : items.map((item) => <div key={item.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}{item.variantName ? ` · ${item.variantName}` : ''}</p><p className="text-xs text-muted-foreground">{item.code} · {item.isOnSale ? <><span className="line-through">{formatPrice(item.price)}</span> <span className="text-destructive">{formatPrice(salePrice(item.price, true, saleDiscount))} (oferta)</span></> : formatPrice(item.price)}</p></div>
            <div className="flex items-center rounded-md border"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeQuantity(item.key, -1)}><Minus className="h-3.5 w-3.5" /></Button><span className="w-8 text-center text-sm">{item.quantity}</span><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeQuantity(item.key, 1)}><Plus className="h-3.5 w-3.5" /></Button></div>
            <strong className="w-16 text-right text-sm">{formatPrice((item.isOnSale ? salePrice(item.price, true, saleDiscount) : item.price) * item.quantity)}</strong>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(items.filter((entry) => entry.key !== item.key))}><Trash2 className="h-4 w-4" /></Button>
          </div>)}
        </div>

        <div><Label>Observaciones (opcional)</Label><Textarea value={observations} onChange={(event) => setObservations(event.target.value)} /></div>
        <div className="rounded-lg bg-primary/10 p-4">
          {offerSubtotal > 0 && <div className="mb-2 space-y-1 border-b border-primary/20 pb-2 text-sm"><div className="flex justify-between"><span>Productos normales</span><span>{formatPrice(normalSubtotal)}</span></div><div className="flex justify-between text-destructive"><span>Productos en oferta (-{saleDiscount}%)</span><span>{formatPrice(offerSubtotal)}</span></div></div>}
          <div className="flex items-center justify-between"><span className="font-medium">Subtotal</span><strong className="text-xl text-primary">{formatPrice(subtotal)}</strong></div>
          <div className="mt-3 border-t border-primary/20 pt-3" aria-live="polite">
            {calculating ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Calculando descuento…</p> : quoteError && needsQuote ? <p className="text-sm text-destructive">{quoteError}</p> : <>
              {needsQuote && currentQuote && currentQuote.amount > 0 && <div className="mb-2 flex justify-between gap-2 text-sm"><span>{currentQuote.source} ({currentQuote.percent}%)</span><span>-{formatPrice(currentQuote.amount)}</span></div>}
              {needsQuote && currentQuote?.couponError && <p className="mb-2 text-sm text-destructive">{currentQuote.couponError}</p>}
              {applyWholesaleDiscount && currentQuote?.amount === 0 && nextTier && <p className="mb-2 text-sm text-muted-foreground">Faltan {formatPrice(nextTier.min - normalSubtotal)} en productos normales para mayorista ({nextTier.discount}%).</p>}
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatPrice(needsQuote && currentQuote ? currentQuote.total : subtotal)}</span></div>
            </>}
          </div>
        </div>
        {(applyWholesaleDiscount || couponCode.trim()) && <p className="-mt-3 text-xs text-muted-foreground">El cupón y el total definitivo se validarán al guardar el pedido.</p>}
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Creando pedido…' : 'Crear pedido pendiente'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
