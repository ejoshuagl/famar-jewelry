'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, UserPlus } from 'lucide-react'

const permissionOptions = [
  ['dashboard', 'Dashboard'], ['products', 'Productos'], ['orders', 'Pedidos'], ['categories', 'Categorías'],
  ['campaigns', 'Publicidad'], ['themes', 'Temas'], ['wholesale', 'Mayoristas'], ['coupons', 'Cupones'], ['users', 'Usuarios'],
] as const
type AdminUser = { id: string; username: string; name: string | null; permissions: string[] | null; active: boolean }
type AuditEntry = { id: string; action: string; entity: string; admin: string; details: string | null; createdAt: string }

export function AdminUsersView() {
  const token = useAuthStore((state) => state.token)
  const queryClient = useQueryClient()
  const headers = { 'Content-Type': 'application/json', 'x-admin-token': token || '' }
  const [form, setForm] = useState({ name: '', username: '', password: '', permissions: ['dashboard'] as string[] })
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({ queryKey: ['admin-users'], queryFn: async () => {
    const response = await fetch('/api/admin-users', { headers })
    if (!response.ok) throw new Error('No se pudieron cargar los usuarios')
    return response.json()
  } })
  const { data: logs = [] } = useQuery<AuditEntry[]>({ queryKey: ['audit-logs'], queryFn: async () => {
    const response = await fetch('/api/audit-logs', { headers })
    if (!response.ok) return []
    return response.json()
  } })
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['audit-logs'] }) }
  const create = useMutation({ mutationFn: async () => {
    const response = await fetch('/api/admin-users', { method: 'POST', headers, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
  }, onSuccess: () => { toast.success('Usuario administrativo creado'); setForm({ name: '', username: '', password: '', permissions: ['dashboard'] }); refresh() }, onError: (error) => toast.error(error.message) })
  const update = async (id: string, body: object) => {
    const response = await fetch(`/api/admin-users/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error)
    toast.success('Permisos actualizados'); refresh()
  }
  const remove = async (user: AdminUser) => {
    if (!window.confirm(`¿Eliminar definitivamente al usuario ${user.username}?`)) return
    const response = await fetch(`/api/admin-users/${user.id}`, { method: 'DELETE', headers })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error)
    toast.success('Usuario eliminado'); refresh()
  }
  const toggleFormPermission = (permission: string) => setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }))

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Usuarios administrativos</h1><p className="text-sm text-muted-foreground">Crea accesos independientes y controla qué puede gestionar cada persona.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5" />Crear usuario</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3"><div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>Usuario</Label><Input value={form.username} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value })} /></div><div><Label>Contraseña temporal</Label><Input type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></div>
      <div><Label>Permisos</Label><div className="mt-2 flex flex-wrap gap-3">{permissionOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Checkbox checked={form.permissions.includes(value)} onCheckedChange={() => toggleFormPermission(value)} />{label}</label>)}</div></div>
      <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear usuario</Button>
    </CardContent></Card>
    <div className="grid gap-4">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : users.map((user) => { const protectedUser = user.username === 'joshua'; return <Card key={user.id}><CardContent className="space-y-4 p-4">
      <div className="flex items-center justify-between"><div><p className="font-semibold">{user.name || user.username}</p><p className="text-sm text-muted-foreground">@{user.username}</p></div><div className="flex items-center gap-2">{protectedUser && <Badge variant="outline">Superusuario protegido</Badge>}<Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Activo' : 'Desactivado'}</Badge><Switch checked={user.active} disabled={protectedUser} onCheckedChange={(active) => update(user.id, { active })} /></div></div>
      {!protectedUser && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input defaultValue={user.name || ''} id={`name-${user.id}`} placeholder="Nombre" /><Input defaultValue={user.username} id={`username-${user.id}`} placeholder="Usuario" /><Button variant="outline" onClick={() => { const name = (document.getElementById(`name-${user.id}`) as HTMLInputElement).value; const username = (document.getElementById(`username-${user.id}`) as HTMLInputElement).value; update(user.id, { name, username }) }}><Save className="mr-2 h-4 w-4" />Guardar</Button></div>}
      <div className="flex flex-wrap gap-2">{permissionOptions.map(([value, label]) => { const checked = user.permissions === null || user.permissions.includes(value); return <label key={value} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs"><Checkbox checked={checked} disabled={protectedUser} onCheckedChange={() => { const current = user.permissions === null ? permissionOptions.map(([permission]) => permission) : user.permissions; update(user.id, { permissions: checked ? current.filter((item) => item !== value) : [...current, value] }) }} />{label}</label> })}</div>
      {!protectedUser && <div className="flex flex-wrap justify-between gap-3"><div className="flex max-w-sm flex-1 gap-2"><Input type="password" placeholder="Nueva contraseña (opcional)" id={`password-${user.id}`} /><Button variant="outline" onClick={() => { const input = document.getElementById(`password-${user.id}`) as HTMLInputElement; if (input.value.length < 8) return toast.error('Usa mínimo 8 caracteres'); update(user.id, { password: input.value }); input.value = '' }}>Cambiar clave</Button></div><Button variant="outline" className="text-destructive" onClick={() => remove(user)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button></div>}
    </CardContent></Card>})}</div>
    <Card><CardHeader><CardTitle className="text-lg">Actividad administrativa</CardTitle></CardHeader><CardContent><div className="max-h-96 space-y-2 overflow-y-auto">{logs.map((log) => <div key={log.id} className="grid gap-1 rounded-md border p-3 text-sm md:grid-cols-[160px_120px_140px_1fr]"><span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString('es-EC')}</span><strong>{log.admin}</strong><span>{log.action} · {log.entity}</span><span className="text-muted-foreground">{log.details || 'Sin detalle'}</span></div>)}</div></CardContent></Card>
  </div>
}
