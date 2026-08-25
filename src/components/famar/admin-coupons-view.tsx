'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'

interface Coupon { id: string; code: string; description: string; discount: number; minPurchase: number; active: boolean; startsAt: string | null; endsAt: string | null; usageLimit: number | null; usageCount: number }
const EMPTY = { code: '', description: '', discount: 10, minPurchase: 0, active: true, startsAt: '', endsAt: '', unlimited: true, usageLimit: 1 }

export function AdminCouponsView() {
  const token = useAuthStore((state) => state.token); const [coupons, setCoupons] = useState<Coupon[]>([]); const [editing, setEditing] = useState<Coupon | null>(null); const [form, setForm] = useState(EMPTY); const [open, setOpen] = useState(false)
  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'x-admin-token': token || '' }), [token])
  const load = useCallback(() => fetch('/api/coupons', { headers: headers() }).then((r) => r.json()).then((data) => setCoupons(data.coupons || [])), [headers])
  useEffect(() => { load() }, [load])
  const startCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const startEdit = (coupon: Coupon) => { setEditing(coupon); setForm({ ...coupon, startsAt: coupon.startsAt?.slice(0, 16) || '', endsAt: coupon.endsAt?.slice(0, 16) || '', unlimited: coupon.usageLimit === null, usageLimit: coupon.usageLimit || 1 }); setOpen(true) }
  const save = async () => {
    const response = await fetch(editing ? `/api/coupons/${editing.id}` : '/api/coupons', { method: editing ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(form) })
    if (!response.ok) return toast.error((await response.json()).error || 'No se pudo guardar')
    toast.success(editing ? 'Cupón actualizado' : 'Cupón creado'); setOpen(false); load()
  }
  const remove = async (coupon: Coupon) => { if (!window.confirm(`¿Eliminar el cupón ${coupon.code}?`)) return; await fetch(`/api/coupons/${coupon.id}`, { method: 'DELETE', headers: headers() }); toast.success('Cupón eliminado'); load() }

  return <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Cupones de descuento</h1><p className="mt-1 text-sm text-muted-foreground">Crea códigos para promociones y clientes especiales.</p></div><Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Nuevo cupón</Button></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{coupons.map((coupon) => <Card key={coupon.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="font-mono text-lg font-bold text-primary">{coupon.code}</p><p className="text-sm text-muted-foreground">{coupon.description || 'Sin descripción'}</p></div><span className={`rounded-full px-2 py-1 text-xs ${coupon.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{coupon.active ? 'Activo' : 'Inactivo'}</span></div><div className="my-4 text-3xl font-bold">{coupon.discount}% OFF</div><div className="space-y-1 text-xs text-muted-foreground"><p>Compra mínima: ${Number(coupon.minPurchase).toFixed(2)}</p><p>Reclamaciones: <strong className="text-foreground">{coupon.usageCount}</strong> / {coupon.usageLimit === null ? 'Ilimitadas' : coupon.usageLimit}</p>{coupon.usageLimit !== null ? <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (coupon.usageCount / coupon.usageLimit) * 100)}%` }} /></div> : null}</div><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => startEdit(coupon)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button variant="outline" size="sm" onClick={() => remove(coupon)}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button></div></CardContent></Card>)}</div>
    {!coupons.length ? <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">Aún no hay cupones creados.</div> : null}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Editar cupón' : 'Nuevo cupón'}</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="FAMAR10" /></div><div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Descuento %</Label><Input type="number" min="1" max="90" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></div><div><Label>Compra mínima</Label><Input type="number" min="0" value={form.minPurchase} onChange={(e) => setForm({ ...form, minPurchase: Number(e.target.value) })} /></div></div><div className="rounded-lg border p-3"><div className="flex items-center justify-between"><Label>Reclamaciones ilimitadas</Label><Switch checked={form.unlimited} onCheckedChange={(unlimited) => setForm({ ...form, unlimited })} /></div>{!form.unlimited ? <div className="mt-3"><Label>Número máximo de personas</Label><Input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Math.max(1, Number(e.target.value)) })} /></div> : null}</div><div className="grid grid-cols-2 gap-3"><div><Label>Desde (opcional)</Label><Input type="datetime-local" value={form.startsAt || ''} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div><div><Label>Hasta (opcional)</Label><Input type="datetime-local" value={form.endsAt || ''} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div></div><div className="flex items-center justify-between rounded-lg border p-3"><Label>Activo</Label><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /></div><Button onClick={save}>Guardar cupón</Button></div></DialogContent></Dialog>
  </section>
}
