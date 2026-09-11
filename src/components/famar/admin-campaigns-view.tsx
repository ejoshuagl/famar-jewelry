'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Edit, Megaphone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageUploader } from './image-uploader'
import { convertDriveUrl, formatPrice } from '@/lib/utils'

interface Campaign {
  id: string
  title: string
  message: string | null
  image: string | null
  placement: 'popup' | 'banner'
  bannerImage: string | null
  popupImage: string | null
  displayMode: 'popup' | 'banner' | 'both'
  ctaLabel: string | null
  ctaView: string | null
  startAt: string
  endAt: string
  indefinite: boolean
  active: boolean
  priority: number
  productIds: string[]
  couponId: string | null
  coupon?: { id: string; code: string; discount: number } | null
  dailySaleLinked?: boolean
  investmentIds: string[]
  investmentLabels?: Array<{ id: string; description: string; purchasedAt: string }>
  performance?: { clicks: number; cartAdds: number; orders: number; confirmedOrders: number; revenue: number; couponOrders: number; dailySaleOrders: number }
}

interface CampaignForm {
  title: string
  message: string
  bannerImage: string
  popupImage: string
  displayMode: 'popup' | 'banner' | 'both'
  ctaLabel: string
  ctaView: string
  startAt: string
  endAt: string
  indefinite: boolean
  active: boolean
  priority: string
  productIds: string[]
  couponId: string
  dailySaleLinked: boolean
  investmentIds: string[]
}

const toEcuadorInput = (value: string | Date) => {
  const shifted = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}

const initialForm = (): CampaignForm => {
  const start = new Date()
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    title: '', message: '', bannerImage: '', popupImage: '', displayMode: 'both', ctaLabel: 'Ver catálogo',
    ctaView: 'catalog', startAt: toEcuadorInput(start), endAt: toEcuadorInput(end), indefinite: false, active: true, priority: '0', productIds: [], couponId: '', dailySaleLinked: false, investmentIds: [],
  }
}

export function AdminCampaignsView() {
  const queryClient = useQueryClient()
  const { adminName } = useAuthStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CampaignForm>(initialForm)
  const [productSearch, setProductSearch] = useState('')
  const [productCategory, setProductCategory] = useState('all')
  const [productVisibility, setProductVisibility] = useState('all')
  const [productBadge, setProductBadge] = useState('all')
  const [productInvestment, setProductInvestment] = useState('all')

  const headers = () => ({
    'Content-Type': 'application/json',
    'x-admin-name': adminName || '',
    'x-admin-token': useAuthStore.getState().token || '',
  })

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns?all=true', { headers: headers() })
      if (!response.ok) throw new Error('No se pudieron cargar las publicidades')
      return response.json() as Promise<Campaign[]>
    },
  })

  const { data: productsData } = useQuery({
    queryKey: ['campaign-products'],
    queryFn: async () => {
      const response = await fetch('/api/products?all=true&compact=true&limit=500', { headers: headers() })
      if (!response.ok) throw new Error('No se pudieron cargar los productos')
      return response.json()
    },
  })
  const { data: couponData } = useQuery({
    queryKey: ['campaign-coupons'],
    queryFn: async () => {
      const response = await fetch('/api/coupons', { headers: headers(), cache: 'no-store' })
      if (!response.ok) return { coupons: [] }
      return response.json() as Promise<{ coupons: Array<{ id: string; code: string; discount: number; active: boolean }> }>
    },
  })
  const coupons = couponData?.coupons || []
  const products = (productsData?.products || []) as Array<{ id: string; name: string; code: string; mainImage?: string; category?: { name: string }; visible: boolean; isNew: boolean; isOnSale: boolean; isDailySale?: boolean; isDailyFeatured?: boolean; investmentId?: string | null; investment?: { description: string; purchasedAt: string } | null }>
  const productCategories = Array.from(new Set(products.map((product) => product.category?.name).filter(Boolean) as string[])).sort()
  const investments = Array.from(new Map(products.filter((product) => product.investmentId && product.investment).map((product) => [product.investmentId as string, { id: product.investmentId as string, ...product.investment! }])).values()).sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())
  const normalizedSearch = productSearch.trim().toLowerCase()
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !normalizedSearch || `${product.name} ${product.code} ${product.category?.name || ''}`.toLowerCase().includes(normalizedSearch)
    const matchesCategory = productCategory === 'all' || product.category?.name === productCategory
    const matchesVisibility = productVisibility === 'all'
      || (productVisibility === 'visible' && product.visible)
      || (productVisibility === 'hidden' && !product.visible)
    const matchesBadge = productBadge === 'all'
      || (productBadge === 'new' && product.isNew)
      || (productBadge === 'featured' && product.isDailyFeatured)
      || (productBadge === 'sale' && product.isOnSale)
      || (productBadge === 'daily-sale' && product.isDailySale)
    const matchesInvestment = productInvestment === 'all' || product.investmentId === productInvestment
    return matchesSearch && matchesCategory && matchesVisibility && matchesBadge && matchesInvestment
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(editingId ? `/api/campaigns/${editingId}` : '/api/campaigns', {
        method: editingId ? 'PUT' : 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'No se pudo guardar')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(editingId ? 'Publicidad actualizada' : 'Publicidad creada')
      setDialogOpen(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE', headers: headers() })
      if (!response.ok) throw new Error('No se pudo eliminar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Publicidad eliminada')
    },
    onError: () => toast.error('No se pudo eliminar la publicidad'),
  })

  const confirmDeleteCampaign = (campaign: Campaign) => {
    if (!window.confirm(`¿Eliminar definitivamente la publicidad “${campaign.title}”?\n\nEsta acción quitará el banner o flotante y sus asociaciones con productos, importaciones, ofertas y cupón.`)) return
    deleteMutation.mutate(campaign.id)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(initialForm())
    setProductSearch('')
    setProductCategory('all')
    setProductVisibility('all')
    setProductBadge('all')
    setProductInvestment('all')
    setDialogOpen(true)
  }

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id)
    setForm({
      title: campaign.title,
      message: campaign.message || '',
      bannerImage: campaign.bannerImage || (campaign.placement === 'banner' ? campaign.image || '' : ''),
      popupImage: campaign.popupImage || (campaign.placement === 'popup' ? campaign.image || '' : ''),
      displayMode: campaign.displayMode || campaign.placement,
      ctaLabel: campaign.ctaLabel || '',
      ctaView: campaign.ctaView || 'catalog',
      startAt: toEcuadorInput(campaign.startAt),
      endAt: toEcuadorInput(campaign.endAt),
      indefinite: campaign.indefinite === true,
      active: campaign.active,
      priority: String(campaign.priority),
      productIds: campaign.productIds || [],
      couponId: campaign.couponId || '',
      dailySaleLinked: campaign.dailySaleLinked === true,
      investmentIds: campaign.investmentIds || [],
    })
    setProductSearch('')
    setProductCategory('all')
    setProductVisibility('all')
    setProductBadge(campaign.dailySaleLinked ? 'daily-sale' : 'all')
    setProductInvestment('all')
    setDialogOpen(true)
  }

  const now = new Date()
  const statusOf = (campaign: Campaign) => {
    if (!campaign.active) return { label: 'Pausada', variant: 'secondary' as const }
    if (new Date(campaign.startAt) > now) return { label: 'Programada', variant: 'outline' as const }
    if (!campaign.indefinite && new Date(campaign.endAt) < now) return { label: 'Finalizada', variant: 'secondary' as const }
    return { label: 'Activa', variant: 'default' as const }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Publicidad</h1>
          <p className="text-sm text-muted-foreground">Programa banners y ventanas flotantes usando la hora de Ecuador.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva publicidad</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando publicidades…</p> : campaigns.map((campaign) => {
          const status = statusOf(campaign)
          return (
            <Card key={campaign.id} className="overflow-hidden">
              {(campaign.bannerImage || campaign.popupImage || campaign.image) && <img src={campaign.bannerImage || campaign.popupImage || campaign.image || ''} alt="" className="h-40 w-full object-cover" />}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{campaign.title}</h2>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant="outline">{campaign.displayMode === 'both' ? 'Banner + Flotante' : campaign.displayMode === 'popup' ? 'Flotante' : 'Banner'}</Badge>
                      {campaign.coupon && <Badge variant="outline">Cupón {campaign.coupon.code} · {campaign.coupon.discount}%</Badge>}
                      {campaign.dailySaleLinked && <Badge variant="destructive">Oferta diaria</Badge>}
                    </div>
                    {campaign.message && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.message}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(campaign)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => confirmDeleteCampaign(campaign)} aria-label={`Eliminar publicidad ${campaign.title}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {new Date(campaign.startAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })} — {campaign.indefinite ? 'Sin fecha de finalización' : new Date(campaign.endAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}
                </div>
                {campaign.investmentLabels?.length ? <p className="text-xs text-muted-foreground">Importaciones: {campaign.investmentLabels.map((item) => item.description).join(', ')}</p> : null}
                <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                  <div><p className="font-semibold">{campaign.performance?.clicks || 0}</p><p className="text-[10px] text-muted-foreground">Visitas</p></div>
                  <div><p className="font-semibold">{campaign.performance?.cartAdds || 0}</p><p className="text-[10px] text-muted-foreground">Al carrito</p></div>
                  <div><p className="font-semibold">{campaign.performance?.confirmedOrders || 0}</p><p className="text-[10px] text-muted-foreground">Ventas</p></div>
                  <div><p className="font-semibold">{formatPrice(campaign.performance?.revenue || 0)}</p><p className="text-[10px] text-muted-foreground">Ingresos</p></div>
                </div>
                {(campaign.coupon || campaign.dailySaleLinked) && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Pedidos por cupón: <strong className="text-foreground">{campaign.performance?.couponOrders || 0}</strong></span><span>·</span><span>Pedidos por oferta diaria: <strong className="text-foreground">{campaign.performance?.dailySaleOrders || 0}</strong></span></div>}
              </CardContent>
            </Card>
          )
        })}
        {!isLoading && campaigns.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><Megaphone className="h-8 w-8 text-muted-foreground" /><p>No hay publicidades creadas.</p></CardContent></Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar publicidad' : 'Nueva publicidad'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Mensaje</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Dónde mostrar</Label><Select value={form.displayMode} onValueChange={(value: 'popup' | 'banner' | 'both') => setForm({ ...form, displayMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Banner y ventana flotante</SelectItem><SelectItem value="banner">Solo banner</SelectItem><SelectItem value="popup">Solo ventana flotante</SelectItem></SelectContent></Select></div>
            {(form.displayMode === 'banner' || form.displayMode === 'both') && <ImageUploader label="Imagen horizontal para banner *" hint="Recomendado 1536 × 512 px, JPG, PNG o WEBP." value={form.bannerImage} onChange={(value) => setForm({ ...form, bannerImage: value as string })} />}
            {(form.displayMode === 'popup' || form.displayMode === 'both') && <ImageUploader label="Imagen vertical para flotante *" hint="Recomendado 1080 × 1350 px, JPG, PNG o WEBP." value={form.popupImage} onChange={(value) => setForm({ ...form, popupImage: value as string })} />}
            <div><Label>Prioridad</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
            <div><Label>Empieza *</Label><Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
            <div><Label>Termina {form.indefinite ? '' : '*'}</Label><Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} disabled={form.indefinite} /></div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Tiempo indefinido</p><p className="text-xs text-muted-foreground">La publicidad seguirá activa hasta que la pauses manualmente.</p></div><Switch checked={form.indefinite} onCheckedChange={(indefinite) => setForm({ ...form, indefinite })} /></div>
            <div><Label>Texto del botón</Label><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} /></div>
            <div><Label>Destino del botón</Label><Select value={form.ctaView} onValueChange={(value) => setForm({ ...form, ctaView: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="catalog">Catálogo</SelectItem><SelectItem value="contact">Contacto</SelectItem><SelectItem value="out-of-stock">Agotados</SelectItem><SelectItem value="jewelry-care">Cuidados</SelectItem><SelectItem value="home">Inicio</SelectItem></SelectContent></Select></div>
            <div className="sm:col-span-2 rounded-lg border p-4 space-y-4">
              <div><Label>Cupón asociado</Label><Select value={form.couponId || 'none'} onValueChange={(value) => setForm({ ...form, couponId: value === 'none' ? '' : value })}><SelectTrigger className="mt-1"><SelectValue placeholder="Sin cupón" /></SelectTrigger><SelectContent><SelectItem value="none">Sin cupón asociado</SelectItem>{coupons.map((coupon) => <SelectItem key={coupon.id} value={coupon.id}>{coupon.code} · {coupon.discount}%{coupon.active ? '' : ' · Inactivo'}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Los pedidos que utilicen este cupón se atribuirán a esta campaña.</p></div>
              <div className="flex items-center justify-between gap-4"><div><Label>Usar ofertas automáticas diarias</Label><p className="text-xs text-muted-foreground">Los productos se reemplazan automáticamente cada día según la configuración de Ofertas. La selección manual queda deshabilitada.</p></div><Switch checked={form.dailySaleLinked} onCheckedChange={(dailySaleLinked) => { setForm({ ...form, dailySaleLinked, productIds: dailySaleLinked ? [] : form.productIds, investmentIds: dailySaleLinked ? [] : form.investmentIds }); if (dailySaleLinked) setProductBadge('daily-sale') }} /></div>
            </div>
            <div className="sm:col-span-2 space-y-2 rounded-lg border p-4">
              <div className="flex items-end justify-between gap-3"><div><Label>Importaciones asociadas</Label><p className="text-xs text-muted-foreground">Incluye la mercadería de esas compras y permite medir qué importación responde a la campaña.</p></div><Badge variant="outline">{form.investmentIds.length} seleccionadas</Badge></div>
              <div className="grid gap-2 sm:grid-cols-2">{investments.map((investment) => { const checked = form.investmentIds.includes(investment.id); return <label key={investment.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2"><Checkbox checked={checked} disabled={form.dailySaleLinked} onCheckedChange={() => setForm((current) => ({ ...current, investmentIds: checked ? current.investmentIds.filter((id) => id !== investment.id) : [...current.investmentIds, investment.id] }))} /><span className="text-sm">{investment.description} · {new Date(investment.purchasedAt).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' })}</span></label> })}</div>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0"><Label>Productos de la campaña</Label><p className="text-xs text-muted-foreground">{form.dailySaleLinked ? 'Se mostrarán automáticamente las ofertas vigentes de cada día.' : 'Puedes seleccionar productos individuales o asociar importaciones completas.'}</p></div>
                <Badge variant="outline" className="shrink-0">{form.dailySaleLinked ? `${products.filter((product) => product.isOnSale).length} ofertas activas hoy` : `${form.productIds.length} seleccionados`}</Badge>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <Input className="min-w-0 sm:col-span-2" placeholder="Buscar por nombre o código…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                <Select value={productCategory} onValueChange={setProductCategory}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{productCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={productVisibility} onValueChange={setProductVisibility}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Visibilidad" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Visibles y ocultos</SelectItem><SelectItem value="visible">Solo visibles</SelectItem><SelectItem value="hidden">Solo ocultos</SelectItem></SelectContent>
                </Select>
                <Select value={productBadge} onValueChange={setProductBadge}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las etiquetas</SelectItem>
                    <SelectItem value="new">Nuevos</SelectItem>
                    <SelectItem value="featured">Destacados de hoy</SelectItem>
                    <SelectItem value="sale">En oferta</SelectItem>
                    <SelectItem value="daily-sale">Ofertas automáticas de hoy</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productInvestment} onValueChange={setProductInvestment}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Importación" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las importaciones</SelectItem>{investments.map((investment) => <SelectItem key={investment.id} value={investment.id}>{investment.description}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-col items-stretch gap-2 rounded-lg bg-muted/50 p-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">{filteredProducts.length} resultados filtrados</p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setForm((current) => ({ ...current, productIds: Array.from(new Set([...current.productIds, ...filteredProducts.map((product) => product.id)])) }))}
                    disabled={filteredProducts.length === 0 || form.dailySaleLinked}
                  >
                    Seleccionar todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const filteredIds = new Set(filteredProducts.map((product) => product.id))
                      setForm((current) => ({ ...current, productIds: current.productIds.filter((id) => !filteredIds.has(id)) }))
                    }}
                    disabled={filteredProducts.length === 0 || form.dailySaleLinked}
                  >
                    Quitar resultados
                  </Button>
                </div>
              </div>
              <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {filteredProducts.map((product) => {
                  const checked = form.dailySaleLinked ? Boolean(product.isDailySale) : form.productIds.includes(product.id)
                  return (
                    <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/60">
                      <Checkbox
                        checked={checked}
                        disabled={form.dailySaleLinked}
                        onCheckedChange={() => setForm((current) => ({
                          ...current,
                          productIds: checked
                            ? current.productIds.filter((id) => id !== product.id)
                            : [...current.productIds, product.id],
                        }))}
                      />
                      {product.mainImage ? <img src={convertDriveUrl(product.mainImage)} alt="" loading="lazy" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">{product.code} · {product.category?.name}{product.visible ? '' : ' · Oculto'}</span></span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Publicidad activa</p><p className="text-xs text-muted-foreground">Además de las fechas, este interruptor debe estar encendido.</p></div><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando…' : 'Guardar'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
