'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Edit, Megaphone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageUploader } from './image-uploader'

interface Campaign {
  id: string
  title: string
  message: string | null
  image: string | null
  placement: 'popup' | 'banner'
  ctaLabel: string | null
  ctaView: string | null
  startAt: string
  endAt: string
  active: boolean
  priority: number
}

interface CampaignForm {
  title: string
  message: string
  image: string
  placement: 'popup' | 'banner'
  ctaLabel: string
  ctaView: string
  startAt: string
  endAt: string
  active: boolean
  priority: string
}

const toEcuadorInput = (value: string | Date) => {
  const shifted = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}

const initialForm = (): CampaignForm => {
  const start = new Date()
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    title: '', message: '', image: '', placement: 'popup', ctaLabel: 'Ver catálogo',
    ctaView: 'catalog', startAt: toEcuadorInput(start), endAt: toEcuadorInput(end), active: true, priority: '0',
  }
}

export function AdminCampaignsView() {
  const queryClient = useQueryClient()
  const { adminName } = useAuthStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CampaignForm>(initialForm)

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

  const openCreate = () => {
    setEditingId(null)
    setForm(initialForm())
    setDialogOpen(true)
  }

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id)
    setForm({
      title: campaign.title,
      message: campaign.message || '',
      image: campaign.image || '',
      placement: campaign.placement,
      ctaLabel: campaign.ctaLabel || '',
      ctaView: campaign.ctaView || 'catalog',
      startAt: toEcuadorInput(campaign.startAt),
      endAt: toEcuadorInput(campaign.endAt),
      active: campaign.active,
      priority: String(campaign.priority),
    })
    setDialogOpen(true)
  }

  const now = new Date()
  const statusOf = (campaign: Campaign) => {
    if (!campaign.active) return { label: 'Pausada', variant: 'secondary' as const }
    if (new Date(campaign.startAt) > now) return { label: 'Programada', variant: 'outline' as const }
    if (new Date(campaign.endAt) < now) return { label: 'Finalizada', variant: 'secondary' as const }
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
              {campaign.image && <img src={campaign.image} alt="" className="h-40 w-full object-cover" />}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{campaign.title}</h2>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant="outline">{campaign.placement === 'popup' ? 'Flotante' : 'Banner'}</Badge>
                    </div>
                    {campaign.message && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.message}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(campaign)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(campaign.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {new Date(campaign.startAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })} — {new Date(campaign.endAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}
                </div>
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
            <ImageUploader label="Imagen publicitaria" hint="JPG, PNG o WEBP. Se adapta al formato elegido." value={form.image} onChange={(value) => setForm({ ...form, image: value as string })} />
            <div><Label>Formato</Label><Select value={form.placement} onValueChange={(value: 'popup' | 'banner') => setForm({ ...form, placement: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="popup">Ventana flotante</SelectItem><SelectItem value="banner">Banner superior</SelectItem></SelectContent></Select></div>
            <div><Label>Prioridad</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
            <div><Label>Empieza *</Label><Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
            <div><Label>Termina *</Label><Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></div>
            <div><Label>Texto del botón</Label><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} /></div>
            <div><Label>Destino del botón</Label><Select value={form.ctaView} onValueChange={(value) => setForm({ ...form, ctaView: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="catalog">Catálogo</SelectItem><SelectItem value="contact">Contacto</SelectItem><SelectItem value="out-of-stock">Agotados</SelectItem><SelectItem value="jewelry-care">Cuidados</SelectItem><SelectItem value="home">Inicio</SelectItem></SelectContent></Select></div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Publicidad activa</p><p className="text-xs text-muted-foreground">Además de las fechas, este interruptor debe estar encendido.</p></div><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando…' : 'Guardar'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
