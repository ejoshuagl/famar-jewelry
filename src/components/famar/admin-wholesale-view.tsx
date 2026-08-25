'use client'

import { useEffect, useState } from 'react'
import { Save, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'

interface Tier { min: number; discount: number; label: string }

export function AdminWholesaleView() {
  const token = useAuthStore((state) => state.token)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [saleDiscount, setSaleDiscount] = useState(25)
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetch('/api/commerce-settings').then((r) => r.json()).then((data) => { setTiers(data.tiers || []); setSaleDiscount(Number(data.saleDiscount ?? 25)) }) }, [])

  const save = async () => {
    setSaving(true)
    const response = await fetch('/api/commerce-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: JSON.stringify({ tiers, saleDiscount }) })
    setSaving(false)
    if (!response.ok) return toast.error('No se pudo guardar la configuración')
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
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setTiers((current) => [...current, { min: 0, discount: 5, label: 'Beneficio mayorista' }])}><Plus className="mr-2 h-4 w-4" />Agregar nivel</Button><Button onClick={save} disabled={saving || !tiers.length}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
      <p className="text-xs text-muted-foreground">Si el cliente también usa un cupón, la tienda aplicará automáticamente el porcentaje más conveniente.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">Productos en oferta</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="max-w-xs"><Label>Descuento automático %</Label><Input type="number" min="0" max="90" value={saleDiscount} onChange={(event) => setSaleDiscount(Math.min(90, Math.max(0, Number(event.target.value))))} /></div>
      <p className="text-sm text-muted-foreground">Se aplica automáticamente a los productos marcados “En oferta”. Estos productos no cuentan para alcanzar el mínimo mayorista o de un cupón y no reciben un segundo descuento.</p>
      <Button onClick={save} disabled={saving || !tiers.length}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
    </CardContent></Card>
  </section>
}
