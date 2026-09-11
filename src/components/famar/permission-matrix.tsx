'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ACTION_LABELS, PERMISSION_SECTIONS, PERMISSION_PROFILES, expandPermissions, hasPermission } from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

export function PermissionMatrix({ value, onChange, disabled = false }: { value: string[] | null; onChange: (value: string[]) => void; disabled?: boolean }) {
  const own = useAuthStore((s) => s.permissions)
  const selected = expandPermissions(value)
  const toggle = (section: string, action: string, checked: boolean) => {
    const key = `${section}:${action}`
    let next: string[] = selected.filter((p) => p !== key)
    if (checked) {
      next = [...next, `${section}:view`, key]
      if (section === 'products' && ['prices', 'stock', 'offers', 'bulk'].includes(action)) next.push('products:edit')
      if (section === 'users' && action === 'permissions') next.push('users:edit')
    }
    else if (action === 'view') next = next.filter((p) => !p.startsWith(`${section}:`))
    else if (action === 'edit' && section === 'products') next = next.filter((p) => !['products:prices', 'products:stock', 'products:offers', 'products:bulk'].includes(p))
    else if (action === 'edit' && section === 'users') next = next.filter((p) => p !== 'users:permissions')
    onChange([...new Set(next)])
  }
  return <div className="space-y-3">
    {!disabled && <div className="flex flex-wrap gap-2">{Object.entries(PERMISSION_PROFILES).map(([key, profile]) => <Button key={key} type="button" size="sm" variant="outline" onClick={() => onChange(profile.permissions.filter((p) => hasPermission(own, p)))}>{profile.label}</Button>)}</div>}
    <p className="text-xs text-muted-foreground">Ver permite consultar. Las otras acciones se habilitan por separado. Cambiar precios, stock u ofertas requiere también Editar.</p>
    <div className="grid gap-3 lg:grid-cols-2">{PERMISSION_SECTIONS.map((section) => {
      const keys = section.actions.map((a) => `${section.id}:${a}`)
      const allowed = keys.filter((key) => hasPermission(own, key))
      const all = keys.every((key) => selected.includes(key as typeof selected[number]))
      return <div key={section.id} className="rounded-lg border p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-semibold">{section.label}</span><label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox disabled={disabled || !allowed.length} checked={all ? true : keys.some((key) => selected.includes(key as typeof selected[number])) ? 'indeterminate' : false} onCheckedChange={() => onChange(all ? selected.filter((p) => !p.startsWith(`${section.id}:`)) : [...new Set([...selected, ...allowed])])} />Todos</label></div>
        <div className="flex flex-wrap gap-x-4 gap-y-3">{section.actions.map((action) => <label key={action} className="flex items-center gap-2 text-xs"><Checkbox disabled={disabled || !hasPermission(own, `${section.id}:${action}`)} checked={hasPermission(value, `${section.id}:${action}`)} onCheckedChange={(checked) => toggle(section.id, action, checked === true)} />{ACTION_LABELS[action]}</label>)}</div>
      </div>
    })}</div>
  </div>
}
