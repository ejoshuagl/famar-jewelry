'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, RefreshCw, Save, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'

interface Tier { min: number; discount: number; label: string }
interface DailySale { active: boolean; count: number; categoryIds: string[]; rotation: number; campaignId: string | null }
interface DailyProduct { id: string; code: string; name: string }
interface Category { id: string; name: string; active: boolean }

export function AdminWholesaleView() {
  const token = useAuthStore((state) => state.token)
  const queryClient = useQueryClient()
  const [tiers, setTiers] = useState<Tier[]>([])
  const [saleDiscount, setSaleDiscount] = useState(25)
  const [dailySale, setDailySale] = useState<DailySale>({ active: false, count: 25, categoryIds: [], rotation: 0, campaignId: null })
  const [dailyProducts, setDailyProducts] = useState<DailyProduct[]>([])
  const [dailySaleDate, setDailySaleDate] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    Promise.all([
      fetch('/api/commerce-settings?admin=true', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/categories', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([data, categoryData]) => {
      setTiers(data.tiers || [])
      setSaleDiscount(Number(data.saleDiscount ?? 25))
      setDailySale(data.dailySale || { active: false, count: 25, categoryIds: [], rotation: 0, campaignId: null })
      setDailyProducts(data.dailySaleProducts || [])
      setDailySaleDate(data.dailySaleDate || '')
      setCategories((categoryData || []).filter((category: Category) => category.active))
    })
  }, [])

  const save = async (rotateDailySale = false) => {
    setSaving(true)
    const response = await fetch('/api/commerce-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: JSON.stringify({ tiers, saleDiscount, dailySale, rotateDailySale }) })
    setSaving(false)
    if (!response.ok) return toast.error('No se pudo guardar la configuración')
    const updatedSettings = await response.json() as { tiers: Tier[]; saleDiscount: number; dailySale: DailySale; dailySaleProducts: DailyProduct[]; dailySaleDate: string }
    setTiers(updatedSettings.tiers)
    setSaleDiscount(updatedSettings.saleDiscount)
    setDailySale(updatedSettings.dailySale)
    setDailyProducts(updatedSettings.dailySaleProducts || [])
    setDailySaleDate(updatedSettings.dailySaleDate || '')
    queryClient.setQueryData(['commerce-settings'], updatedSettings)
    toast.success('Configuración de descuentos actualizada')
  }

  return <section className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">Ventas mayoristas</h1><p className="mt-1 text-sm text-muted-foreground">Configura los descuentos automáticos según el valor del carrito.</p></div>
    <Card><CardHeader><CardTitle className="text-lg">Niveles de compra</CardTitle></CardHeader><CardContent className="space-y-4">
      {tiers.map((tier, index) => <div key={index} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[140px_140px_1fr_auto] md:items-end">
        <div><Label>Compra mínima</Label><Input type="number" min="0" step="1" value={tier.min} onChange={(e) => setTiers((current) => current.map((item, i) => i === index ? { ...item, min: Number(e.target.value) } : item))} /></div>
        <div><Label>Descuento %</Label><Input type="number" min="1" max="90" value={tier.discount} onChange={(e) => setTiers((current) => current.map((item, i) => i === index ? { ...item, discount: Number(e.target.value) } : item))} /></div>
        <div><Label>Beneficio mostrado</Label><Input value={tier.label} onChange={(e) => setTiers((current) => current.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} /></div>
        <Button variant="outline" size="icon" onClick={() => setTiers((current) => current.filter((_, i) => i !== index))} aria-label="Eliminar nivel"><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setTiers((current) => [...current, { min: 0, discount: 5, label: 'Beneficio mayorista' }])}><Plus className="mr-2 h-4 w-4" />Agregar nivel</Button><Button onClick={() => save()} disabled={saving || !tiers.length}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
      <p className="text-xs text-muted-foreground">Si el cliente también usa un cupón, la tienda aplicará automáticamente el porcentaje más conveniente.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">Productos en oferta</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="max-w-xs"><Label>Descuento automático %</Label><Input type="number" min="0" max="90" value={saleDiscount} onChange={(event) => setSaleDiscount(Math.min(90, Math.max(0, Number(event.target.value))))} /></div>
      <p className="text-sm text-muted-foreground">Se aplica automáticamente a los productos marcados “En oferta”. Estos productos no cuentan para alcanzar el mínimo mayorista o de un cupón y no reciben un segundo descuento.</p>
      <Button onClick={() => save()} disabled={saving || !tiers.length}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-primary" />Ofertas automáticas diarias</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4"><div><Label>Activar rotación diaria</Label><p className="text-xs text-muted-foreground">La selección permanece igual durante el día y cambia a las 00:00 de Ecuador.</p></div><Switch checked={dailySale.active} onCheckedChange={(active) => setDailySale({ ...dailySale, active })} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Cantidad de productos</Label><Input type="number" min="1" max="100" value={dailySale.count} onChange={(event) => setDailySale({ ...dailySale, count: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })} /></div>
        <div><Label>Descuento aplicado</Label><div className="mt-2 text-2xl font-bold text-primary">{saleDiscount}%</div><p className="text-xs text-muted-foreground">Usa el porcentaje configurado en “Productos en oferta”.</p></div>
      </div>
      <div><Label>Categorías participantes</Label><p className="mb-2 text-xs text-muted-foreground">Si no marcas ninguna, participan todas.</p><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 md:grid-cols-3">{categories.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={dailySale.categoryIds.includes(category.id)} onCheckedChange={(checked) => setDailySale({ ...dailySale, categoryIds: checked ? [...dailySale.categoryIds, category.id] : dailySale.categoryIds.filter((id) => id !== category.id) })} />{category.name}</label>)}</div></div>
      <div className="rounded-lg bg-muted/35 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Selección de hoy</p><p className="text-xs text-muted-foreground">{dailySaleDate || 'Hoy'} · {dailyProducts.length} producto{dailyProducts.length === 1 ? '' : 's'}</p></div><Badge variant={dailySale.active ? 'default' : 'secondary'}>{dailySale.active ? 'Activa' : 'Desactivada'}</Badge></div>{dailyProducts.length ? <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{dailyProducts.map((product) => <div key={product.id} className="rounded-md border bg-background px-3 py-2"><p className="truncate text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.code}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Activa y guarda la rotación para visualizar los productos elegidos.</p>}</div>
      <div className="flex flex-wrap gap-3"><Button onClick={() => save()} disabled={saving || !tiers.length}><Save className="mr-2 h-4 w-4" />Guardar rotación</Button><Button variant="outline" onClick={() => save(true)} disabled={saving || !dailySale.active || !tiers.length}><RefreshCw className="mr-2 h-4 w-4" />Cambiar selección ahora</Button></div>
      <p className="text-xs text-muted-foreground">Solo participan productos visibles, disponibles y con stock. La rotación funciona independientemente de las campañas; si una publicidad está vinculada, muestra estas ofertas junto con las manuales.</p>
    </CardContent></Card>
  </section>
}
