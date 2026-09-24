'use client'

import { useEffect, useState } from 'react'
import { BadgePercent, Check, Ghost, Heart, Layers3, Loader2, Snowflake, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type SeasonalThemeName = 'standard' | 'christmas' | 'halloween' | 'black-friday' | 'valentine'
type DesignThemeName = 'original' | 'elegance'

const DESIGN_THEMES = [
  { id: 'original' as const, name: 'FAMAR Original', description: 'La presentación clásica y estable de la marca.', icon: Sparkles },
  { id: 'elegance' as const, name: 'FAMAR Elegance', description: 'Cristal, profundidad, reflejos dorados y movimiento sutil.', icon: Layers3 },
]

const SEASONAL_THEMES = [
  { id: 'standard' as const, name: 'Sin temática', description: 'Mantiene únicamente el tema principal seleccionado.', icon: Sparkles },
  { id: 'christmas' as const, name: 'Navidad', description: 'Detalles festivos y nieve sutil.', icon: Snowflake },
  { id: 'halloween' as const, name: 'Halloween', description: 'Naranja, luna y detalles misteriosos.', icon: Ghost },
  { id: 'black-friday' as const, name: 'Black Friday', description: 'Acentos especiales para promociones.', icon: BadgePercent },
  { id: 'valentine' as const, name: 'San Valentín', description: 'Rosas, corazones y destellos.', icon: Heart },
]

const PREVIEW_CLASS: Record<SeasonalThemeName, string> = {
  standard: 'bg-gradient-to-br from-black via-zinc-900 to-black',
  christmas: 'christmas-theme-preview',
  halloween: 'halloween-theme-preview',
  'black-friday': 'black-friday-theme-preview',
  valentine: 'valentine-theme-preview',
}

export function AdminThemesView() {
  const [activeTheme, setActiveTheme] = useState<SeasonalThemeName>('standard')
  const [activeDesignTheme, setActiveDesignTheme] = useState<DesignThemeName>('original')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const token = useAuthStore((state) => state.token)
  const can = useAuthStore((state) => state.can)

  useEffect(() => {
    fetch('/api/theme').then((response) => response.json()).then((data) => {
      setActiveTheme(SEASONAL_THEMES.some((theme) => theme.id === data.theme) ? data.theme : 'standard')
      setActiveDesignTheme(DESIGN_THEMES.some((theme) => theme.id === data.designTheme) ? data.designTheme : 'original')
    }).finally(() => setLoading(false))
  }, [])

  const saveTheme = async (kind: 'seasonal' | 'design', value: SeasonalThemeName | DesignThemeName) => {
    const savingKey = `${kind}:${value}`
    setSaving(savingKey)
    try {
      const response = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify(kind === 'design' ? { designTheme: value } : { theme: value }),
      })
      if (!response.ok) throw new Error('No se pudo guardar')

      if (kind === 'design') {
        setActiveDesignTheme(value as DesignThemeName)
        window.localStorage.setItem('famar-design-theme', value)
        window.dispatchEvent(new Event('famar-design-theme-change'))
        toast.success(`Tema principal ${DESIGN_THEMES.find((item) => item.id === value)?.name} activado`)
      } else {
        setActiveTheme(value as SeasonalThemeName)
        window.localStorage.setItem('famar-site-theme', value)
        window.dispatchEvent(new Event('famar-site-theme-change'))
        toast.success(`Temática ${SEASONAL_THEMES.find((item) => item.id === value)?.name} activada`)
      }
    } catch {
      toast.error('No se pudo cambiar la apariencia')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-10">
      <div><h1 className="text-2xl font-bold">Temas y estilos</h1><p className="mt-1 text-sm text-muted-foreground">Combina un tema principal con una temática de temporada.</p></div>

      <div className="space-y-4">
        <div><h2 className="text-lg font-semibold">Tema principal</h2><p className="text-sm text-muted-foreground">Define la apariencia general de la tienda.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          {DESIGN_THEMES.map((theme) => {
            const Icon = theme.icon
            const active = activeDesignTheme === theme.id
            const savingKey = `design:${theme.id}`
            return (
              <article key={theme.id} className={cn('overflow-hidden rounded-xl border bg-card', active && 'border-primary ring-1 ring-primary')}>
                <div className={cn('relative flex h-40 items-center justify-center overflow-hidden', theme.id === 'elegance' ? 'design-elegance-preview' : 'bg-gradient-to-br from-black via-zinc-900 to-black')}><Icon className="h-11 w-11 text-primary" /><span className="absolute bottom-4 font-serif text-xl tracking-[0.25em] text-[#d9bd68]">FAMAR</span></div>
                <div className="flex items-center gap-4 p-5">
                  <div className="min-w-0 flex-1"><h3 className="font-semibold">{theme.name}</h3><p className="mt-1 text-sm text-muted-foreground">{theme.description}</p></div>
                  <button disabled={!can('themes:edit') || loading || saving !== null || active} onClick={() => saveTheme('design', theme.id)} className={cn('inline-flex min-w-24 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted')}>{saving === savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <><Check className="mr-1 h-4 w-4" /> Activo</> : 'Activar'}</button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div><h2 className="text-lg font-semibold">Temática</h2><p className="text-sm text-muted-foreground">Añade decoración temporal sin reemplazar el tema principal.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          {SEASONAL_THEMES.map((theme) => {
            const Icon = theme.icon
            const active = activeTheme === theme.id
            const savingKey = `seasonal:${theme.id}`
            return (
              <article key={theme.id} className={cn('overflow-hidden rounded-xl border bg-card', active && 'border-primary ring-1 ring-primary')}>
                <div className={cn('relative flex h-40 items-center justify-center overflow-hidden', PREVIEW_CLASS[theme.id])}><Icon className="h-11 w-11 text-primary" /><span className="absolute bottom-4 font-serif text-xl tracking-[0.25em] text-[#d9bd68]">FAMAR</span></div>
                <div className="flex items-center gap-4 p-5">
                  <div className="min-w-0 flex-1"><h3 className="font-semibold">{theme.name}</h3><p className="mt-1 text-sm text-muted-foreground">{theme.description}</p></div>
                  <button disabled={!can('themes:edit') || loading || saving !== null || active} onClick={() => saveTheme('seasonal', theme.id)} className={cn('inline-flex min-w-24 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted')}>{saving === savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <><Check className="mr-1 h-4 w-4" /> Activa</> : 'Activar'}</button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
