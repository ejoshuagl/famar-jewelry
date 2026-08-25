'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Snowflake, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type ThemeName = 'standard' | 'christmas'

const THEMES = [
  { id: 'standard' as const, name: 'Estándar', description: 'El estilo negro y dorado actual de FAMAR.', icon: Sparkles },
  { id: 'christmas' as const, name: 'Navideño', description: 'Negro, dorado, detalles festivos y nieve sutil.', icon: Snowflake },
]

export function AdminThemesView() {
  const [activeTheme, setActiveTheme] = useState<ThemeName>('standard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<ThemeName | null>(null)
  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    fetch('/api/theme').then((response) => response.json()).then((data) => {
      setActiveTheme(data.theme === 'christmas' ? 'christmas' : 'standard')
    }).finally(() => setLoading(false))
  }, [])

  const activate = async (theme: ThemeName) => {
    setSaving(theme)
    try {
      const response = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify({ theme }),
      })
      if (!response.ok) throw new Error('No se pudo guardar')
      setActiveTheme(theme)
      toast.success(`Tema ${theme === 'christmas' ? 'navideño' : 'estándar'} activado`)
    } catch {
      toast.error('No se pudo cambiar el tema')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Temas y estilos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cambia la apariencia de toda la tienda para tus temporadas.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {THEMES.map((theme) => {
          const Icon = theme.icon
          const active = activeTheme === theme.id
          return (
            <article key={theme.id} className={cn('overflow-hidden rounded-xl border bg-card', active && 'border-primary ring-1 ring-primary')}>
              <div className={cn('relative flex h-44 items-center justify-center overflow-hidden', theme.id === 'christmas' ? 'christmas-theme-preview' : 'bg-gradient-to-br from-black via-zinc-900 to-black')}>
                <Icon className="h-12 w-12 text-primary" />
                <span className="absolute bottom-4 font-serif text-xl tracking-[0.25em] text-[#d9bd68]">FAMAR</span>
              </div>
              <div className="flex items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{theme.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{theme.description}</p>
                </div>
                <button disabled={loading || saving !== null || active} onClick={() => activate(theme.id)} className={cn('inline-flex min-w-24 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted')}>
                  {saving === theme.id ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <><Check className="mr-1 h-4 w-4" /> Activo</> : 'Activar'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
