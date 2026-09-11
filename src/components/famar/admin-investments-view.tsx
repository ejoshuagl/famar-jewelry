'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, HandCoins, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'

type Investment = {
  id: string
  description: string
  merchandise: number
  taxes: number
  total: number
  purchasedAt: string
  notes: string | null
  recovered: number
  balance: number
  remainingUnits: number
  productsInStock: number
  products: Array<{ id: string; code: string; name: string; stock: number; status: string; visible: boolean }>
}

type Summary = {
  totalMerchandise: number
  totalTaxes: number
  totalInvestment: number
  confirmedRevenue: number
  balance: number
}

type FormState = {
  description: string
  merchandise: string
  taxes: string
  purchasedAt: string
  notes: string
}

const todayInEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
const emptySummary: Summary = { totalMerchandise: 0, totalTaxes: 0, totalInvestment: 0, confirmedRevenue: 0, balance: 0 }

export function AdminInvestmentsView() {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [form, setForm] = useState<FormState>({ description: '', merchandise: '', taxes: '', purchasedAt: todayInEcuador(), notes: '' })

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['admin-investments'],
    queryFn: async () => {
      const response = await fetch('/api/investments', { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo cargar la información')
      return response.json() as Promise<{ investments: Investment[]; summary: Summary }>
    },
    staleTime: 30_000,
  })
  const investments = data?.investments || []
  const summary = data?.summary || emptySummary

  const formTotal = useMemo(() => {
    const merchandise = Number(form.merchandise || 0)
    const taxes = Number(form.taxes || 0)
    return Number.isFinite(merchandise + taxes) ? merchandise + taxes : 0
  }, [form.merchandise, form.taxes])

  const startCreate = () => {
    setEditing(null)
    setForm({ description: '', merchandise: '', taxes: '', purchasedAt: todayInEcuador(), notes: '' })
    setOpen(true)
  }

  const startEdit = (investment: Investment) => {
    setEditing(investment)
    setForm({
      description: investment.description,
      merchandise: String(investment.merchandise),
      taxes: String(investment.taxes),
      purchasedAt: investment.purchasedAt.slice(0, 10),
      notes: investment.notes || '',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.description.trim()) return toast.error('Indica qué compra realizaste')
    if (!form.purchasedAt) return toast.error('Selecciona la fecha de compra')
    const merchandise = Number(form.merchandise)
    const taxes = Number(form.taxes || 0)
    if (!Number.isFinite(merchandise) || merchandise < 0 || !Number.isFinite(taxes) || taxes < 0 || merchandise + taxes <= 0) {
      return toast.error('Ingresa valores válidos para mercadería e impuestos')
    }
    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/investments/${editing.id}` : '/api/investments', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, merchandise, taxes }),
      })
      if (!response.ok) throw new Error((await response.json()).error || 'No se pudo guardar')
      toast.success(editing ? 'Inversión actualizada' : 'Inversión registrada')
      setOpen(false)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (investment: Investment) => {
    if (!window.confirm(`¿Eliminar la inversión “${investment.description}”?`)) return
    const response = await fetch(`/api/investments/${investment.id}`, { method: 'DELETE' })
    if (!response.ok) return toast.error((await response.json()).error || 'No se pudo eliminar')
    toast.success('Inversión eliminada')
    refetch()
  }

  const balancePositive = summary.balance >= 0

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inversiones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controla el dinero invertido y compáralo con las ventas confirmadas.</p>
        </div>
        <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Nueva inversión</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Mercadería" value={summary.totalMerchandise} icon={<HandCoins className="h-5 w-5 text-primary" />} />
        <SummaryCard label="Impuestos y aduana" value={summary.totalTaxes} icon={<ReceiptText className="h-5 w-5 text-primary" />} />
        <SummaryCard label="Inversión total" value={summary.totalInvestment} icon={<ArrowDownRight className="h-5 w-5 text-amber-500" />} />
        <Card className={balancePositive ? 'border-emerald-500/35' : 'border-red-500/35'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{balancePositive ? 'Ganancia estimada' : 'Inversión por recuperar'}</p>
              {balancePositive ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : <ArrowDownRight className="h-5 w-5 text-red-500" />}
            </div>
            <p className={`mt-2 text-xl font-bold ${balancePositive ? 'text-emerald-500' : 'text-red-500'}`}>{formatPrice(Math.abs(summary.balance))}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Ventas confirmadas: {formatPrice(summary.confirmedRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Historial de inversiones</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Cargando inversiones…</div>
        ) : investments.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aún no has registrado inversiones.</div>
        ) : (
          <div className="divide-y">
            {investments.map((investment) => (
              <div key={investment.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold">{investment.description}</p>
                    <span className="text-xs text-muted-foreground">{new Date(investment.purchasedAt).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span>Mercadería: <strong className="text-foreground">{formatPrice(investment.merchandise)}</strong></span>
                    <span>Impuestos: <strong className="text-foreground">{formatPrice(investment.taxes)}</strong></span>
                    <span>Total: <strong className="text-primary">{formatPrice(investment.total)}</strong></span>
                    <span>Ventas recuperadas: <strong className="text-foreground">{formatPrice(investment.recovered)}</strong></span>
                    <span>{investment.balance >= 0 ? 'Ganancia' : 'Por recuperar'}: <strong className={investment.balance >= 0 ? 'text-emerald-500' : 'text-amber-500'}>{formatPrice(Math.abs(investment.balance))}</strong></span>
                  </div>
                  <div className="mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-muted-foreground">
                    <strong className="text-primary">{investment.remainingUnits}</strong>
                    <span>{investment.remainingUnits === 1 ? 'unidad pendiente por vender' : 'unidades pendientes por vender'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{investment.productsInStock} {investment.productsInStock === 1 ? 'modelo disponible' : 'modelos disponibles'}</span>
                  </div>
                  {investment.notes ? <p className="mt-2 text-xs text-muted-foreground">{investment.notes}</p> : null}
                  <details className="mt-3 rounded-md border bg-muted/15 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium">Productos de esta importación ({investment.products.length})</summary>
                    {investment.products.length ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {investment.products.map((product) => (
                          <div key={product.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-xs">
                            <span className="min-w-0 truncate"><strong>{product.code}</strong> · {product.name}</span>
                            <span className="shrink-0 text-muted-foreground">Stock {product.stock}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-xs text-muted-foreground">Todavía no hay productos asociados a este lote.</p>}
                  </details>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(investment)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(investment)}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">El balance compara las ventas confirmadas con todas las inversiones registradas. No incluye otros gastos operativos.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar inversión' : 'Registrar inversión'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Descripción de la compra</Label><Input value={form.description} maxLength={120} placeholder="Ej. Mercadería de septiembre" onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div><Label>Fecha de compra</Label><Input type="date" value={form.purchasedAt} onChange={(event) => setForm({ ...form, purchasedAt: event.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor de mercadería</Label><Input type="number" min="0" step="0.01" value={form.merchandise} placeholder="250.00" onChange={(event) => setForm({ ...form, merchandise: event.target.value })} /></div>
              <div><Label>Impuestos / aduana</Label><Input type="number" min="0" step="0.01" value={form.taxes} placeholder="50.00" onChange={(event) => setForm({ ...form, taxes: event.target.value })} /></div>
            </div>
            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">Costo total de esta inversión</p>
              <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(formTotal)}</p>
            </div>
            <div><Label>Notas (opcional)</Label><Textarea value={form.notes} maxLength={500} placeholder="Proveedor, número de envío u otra referencia" onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar inversión'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{label}</p>{icon}</div><p className="mt-2 text-xl font-bold">{formatPrice(value)}</p></CardContent></Card>
}
