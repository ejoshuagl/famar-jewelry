'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from './permission-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PermissionMatrix } from './permission-matrix'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, UserPlus } from 'lucide-react'

type AdminUser = { id: string; username: string; name: string | null; permissions: string[] | null; active: boolean }
type AuditEntry = { id: string; action: string; entity: string; admin: string; details: string | null; createdAt: string }

export function AdminUsersView() {
  const token = useAuthStore((state) => state.token)
  const can = useAuthStore((state) => state.can)
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const [savingPermissions, setSavingPermissions] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const headers = { 'Content-Type': 'application/json', 'x-admin-token': token || '' }
  const [form, setForm] = useState({ name: '', username: '', password: '', permissions: ['dashboard:view'] as string[] })
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({ queryKey: ['admin-users'], queryFn: async () => {
    const response = await fetch('/api/admin-users', { headers })
    if (!response.ok) throw new Error('No se pudieron cargar los usuarios')
    return response.json()
  } })
  const { data: logs = [] } = useQuery<AuditEntry[]>({ queryKey: ['audit-logs'], enabled: can('users:audit'), queryFn: async () => {
    const response = await fetch('/api/audit-logs', { headers })
    if (!response.ok) return []
    return response.json()
  } })
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['audit-logs'] }) }
  const create = useMutation({ mutationFn: async () => {
    const response = await fetch('/api/admin-users', { method: 'POST', headers, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
  }, onSuccess: () => { toast.success('Usuario administrativo creado'); setForm({ name: '', username: '', password: '', permissions: ['dashboard:view'] }); refresh() }, onError: (error) => toast.error(error.message) })
  const update = async (id: string, body: object) => {
    const response = await fetch(`/api/admin-users/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) { toast.error(data.error); return false }
    toast.success('Permisos actualizados'); refresh()
    return true
  }
  const remove = async (user: AdminUser) => {
    if (!window.confirm(`¿Eliminar definitivamente al usuario ${user.username}?`)) return
    const response = await fetch(`/api/admin-users/${user.id}`, { method: 'DELETE', headers })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error)
    toast.success('Usuario eliminado'); refresh()
  }
  const savePermissions = async (id: string) => {
    setSavingPermissions(id)
    try {
      if (await update(id, { permissions: drafts[id] })) setDrafts((current) => { const next = { ...current }; delete next[id]; return next })
    } catch { toast.error('No se pudieron guardar los permisos') }
    finally { setSavingPermissions(null) }
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Usuarios administrativos</h1><p className="text-sm text-muted-foreground">Crea accesos independientes y controla qué puede gestionar cada persona.</p></div>
    {can('users:create') && can('users:permissions') && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5" />Crear usuario</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3"><div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>Usuario</Label><Input value={form.username} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value })} /></div><div><Label>Contraseña temporal</Label><Input type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></div>
      <PermissionMatrix value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} disabled={create.isPending} />
      <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear usuario</Button>
    </CardContent></Card>}
    <div className="grid gap-4">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : users.map((user) => { const protectedUser = user.username === 'joshua'; return <Card key={user.id}><CardContent className="space-y-4 p-4">
      <div className="flex items-center justify-between"><div><p className="font-semibold">{user.name || user.username}</p><p className="text-sm text-muted-foreground">@{user.username}</p></div><div className="flex items-center gap-2">{protectedUser && <Badge variant="outline">Superusuario protegido</Badge>}<Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Activo' : 'Desactivado'}</Badge><Switch checked={user.active} disabled={protectedUser || !can('users:edit')} onCheckedChange={(active) => update(user.id, { active })} /></div></div>
      {!protectedUser && can('users:edit') && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input defaultValue={user.name || ''} id={`name-${user.id}`} placeholder="Nombre" /><Input defaultValue={user.username} id={`username-${user.id}`} placeholder="Usuario" /><Button variant="outline" onClick={() => { const name = (document.getElementById(`name-${user.id}`) as HTMLInputElement).value; const username = (document.getElementById(`username-${user.id}`) as HTMLInputElement).value; update(user.id, { name, username }) }}><Save className="mr-2 h-4 w-4" />Guardar</Button></div>}
      {protectedUser ? <p className="text-sm text-muted-foreground">Joshua tiene acceso completo automático, incluidas las nuevas secciones.</p> : <details><summary className="cursor-pointer text-sm font-medium">Permisos por sección{drafts[user.id] ? ' · Cambios sin guardar' : ''}</summary><div className="mt-3 space-y-3"><PermissionMatrix value={drafts[user.id] ?? user.permissions} disabled={!can('users:edit') || !can('users:permissions') || savingPermissions !== null} onChange={(permissions) => setDrafts((current) => ({ ...current, [user.id]: permissions }))} />{drafts[user.id] && <div className="flex gap-2"><Button disabled={savingPermissions !== null} onClick={() => savePermissions(user.id)}>{savingPermissions === user.id ? 'Guardando…' : 'Guardar permisos'}</Button><Button variant="outline" disabled={savingPermissions !== null} onClick={() => setDrafts((current) => { const next = { ...current }; delete next[user.id]; return next })}>Descartar</Button></div>}</div></details>}
      {!protectedUser && can('users:edit') && <div className="flex flex-wrap justify-between gap-3"><div className="flex max-w-sm flex-1 gap-2"><Input type="password" placeholder="Nueva contraseña (opcional)" id={`password-${user.id}`} /><Button variant="outline" onClick={() => { const input = document.getElementById(`password-${user.id}`) as HTMLInputElement; if (input.value.length < 8) return toast.error('Usa mínimo 8 caracteres'); update(user.id, { password: input.value }); input.value = '' }}>Cambiar clave</Button></div><Button variant="outline" className="text-destructive" permission="users:delete" onClick={() => remove(user)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button></div>}
    </CardContent></Card>})}</div>
    {can('users:audit') && <Card><CardHeader><CardTitle className="text-lg">Actividad administrativa</CardTitle></CardHeader><CardContent><div className="max-h-96 space-y-2 overflow-y-auto">{logs.map((log) => <div key={log.id} className="grid gap-1 rounded-md border p-3 text-sm md:grid-cols-[160px_120px_140px_1fr]"><span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString('es-EC')}</span><strong>{log.admin}</strong><span>{log.action} · {log.entity}</span><span className="text-muted-foreground">{log.details || 'Sin detalle'}</span></div>)}</div></CardContent></Card>}
  </div>
}
