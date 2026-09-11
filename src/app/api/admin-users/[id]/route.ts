import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'
import { ADMIN_PERMISSIONS, auditLog, requireAdmin, type AdminPermission } from '@/lib/admin-auth'
import { expandPermissions, hasPermission, readPermissions } from '@/lib/admin-permissions'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const target = await db.adminUser.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.username === 'joshua') return NextResponse.json({ error: 'El superusuario joshua está protegido y no se puede modificar' }, { status: 403 })
  if (expandPermissions(readPermissions(target.permissions)).some((p) => !hasPermission(admin.permissions, p))) return NextResponse.json({ error: 'No puedes modificar un usuario con permisos superiores a los tuyos' }, { status: 403 })
  if (target.username === admin.username && body.active === false) return NextResponse.json({ error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
  const permissions = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.filter((entry: unknown): entry is AdminPermission => ADMIN_PERMISSIONS.includes(entry as AdminPermission)))]
    : null
  if (permissions && !permissions.length) return NextResponse.json({ error: 'Selecciona al menos un permiso' }, { status: 400 })
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : null
  if (username === 'joshua') return NextResponse.json({ error: 'Ese usuario está reservado' }, { status: 403 })
  if (permissions && (!hasPermission(admin.permissions, 'users:permissions') || expandPermissions(permissions).some((p) => !hasPermission(admin.permissions, p)))) return NextResponse.json({ error: 'No puedes asignar estos permisos' }, { status: 403 })
  if (typeof body.password === 'string' && body.password && (body.password.length < 8 || body.password.length > 72)) return NextResponse.json({ error: 'Usa una contraseña de 8 a 72 caracteres' }, { status: 400 })
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 })
  if (target.username === admin.username && username && username !== target.username) return NextResponse.json({ error: 'No puedes cambiar tu propio usuario durante la sesión' }, { status: 400 })
  if (target.username === admin.username && permissions) return NextResponse.json({ error: 'Otro superusuario debe modificar tus permisos' }, { status: 400 })
  const changes: string[] = []
  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== target.name) changes.push('nombre')
  if (username && username !== target.username) changes.push('usuario')
  if (permissions) {
    const before = expandPermissions(readPermissions(target.permissions))
    const after = expandPermissions(permissions)
    changes.push(`permisos añadidos: ${after.filter((p) => !before.includes(p)).join(', ') || 'ninguno'}; retirados: ${before.filter((p) => !after.includes(p)).join(', ') || 'ninguno'}`)
  }
  if (typeof body.active === 'boolean' && body.active !== target.active) changes.push(body.active ? 'activado' : 'desactivado')
  if (typeof body.password === 'string' && body.password) changes.push('contraseña')
  await db.adminUser.update({ where: { id }, data: {
    ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim().slice(0, 80) } : {}),
    ...(username ? { username } : {}),
    ...(permissions ? { permissions: JSON.stringify(permissions) } : {}),
    ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    ...(typeof body.password === 'string' && body.password ? { password: await hashPassword(body.password) } : {}),
  } })
  await auditLog({ action: 'update', entity: 'admin-user', entityId: id, admin: admin.name, details: `${target.username}: ${changes.join(', ') || 'sin cambios'}` })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const target = await db.adminUser.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.username === 'joshua') return NextResponse.json({ error: 'El superusuario joshua está protegido y no se puede eliminar' }, { status: 403 })
  if (expandPermissions(readPermissions(target.permissions)).some((p) => !hasPermission(admin.permissions, p))) return NextResponse.json({ error: 'No puedes eliminar un usuario con permisos superiores a los tuyos' }, { status: 403 })
  if (target.username === admin.username) return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 })
  const activeManagers = await db.adminUser.findMany({ where: { active: true }, select: { id: true, permissions: true } })
  const managers = activeManagers.filter((user) => !user.permissions || (() => { try { return JSON.parse(user.permissions).includes('users') } catch { return false } })())
  const targetIsManager = !target.permissions || (() => { try { return JSON.parse(target.permissions).includes('users') } catch { return false } })()
  if (targetIsManager && managers.length <= 1) return NextResponse.json({ error: 'Debe quedar al menos un administrador de usuarios' }, { status: 400 })
  await db.adminUser.delete({ where: { id } })
  await auditLog({ action: 'delete', entity: 'admin-user', entityId: id, admin: admin.name, details: target.username })
  return NextResponse.json({ success: true })
}
