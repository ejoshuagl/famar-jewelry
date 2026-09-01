import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'
import { ADMIN_PERMISSIONS, auditLog, requireAdmin, type AdminPermission } from '@/lib/admin-auth'
import { ensureAdminUserPermissions } from '@/lib/admin-users'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureAdminUserPermissions()
  const admin = requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const target = await db.adminUser.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.username === admin.username && body.active === false) return NextResponse.json({ error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
  const permissions = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.filter((entry: unknown): entry is AdminPermission => ADMIN_PERMISSIONS.includes(entry as AdminPermission)))]
    : null
  if (permissions && !permissions.length) return NextResponse.json({ error: 'Selecciona al menos un permiso' }, { status: 400 })
  await db.adminUser.update({ where: { id }, data: {
    ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim().slice(0, 80) } : {}),
    ...(permissions ? { permissions: JSON.stringify(permissions) } : {}),
    ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    ...(typeof body.password === 'string' && body.password ? { password: await hashPassword(body.password) } : {}),
  } })
  await auditLog({ action: 'update', entity: 'admin-user', entityId: id, admin: admin.name, details: target.username })
  return NextResponse.json({ success: true })
}
