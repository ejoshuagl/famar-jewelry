import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'
import { ADMIN_PERMISSIONS, auditLog, isSuperAdminUsername, requireAdmin, type AdminPermission } from '@/lib/admin-auth'
import { expandPermissions, hasPermission, readPermissions } from '@/lib/admin-permissions'

function parsePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((entry): entry is AdminPermission => ADMIN_PERMISSIONS.includes(entry as AdminPermission)))]
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const users = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, username: true, name: true, permissions: true, active: true, createdAt: true } })
  return NextResponse.json(users.map((user) => ({ ...user, permissions: isSuperAdminUsername(user.username) ? null : readPermissions(user.permissions) })), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json()
  const username = String(body.username || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const password = String(body.password || '')
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || name.length < 2 || name.length > 80 || password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: 'Revisa el nombre, usuario y contraseña (mínimo 8 caracteres)' }, { status: 400 })
  }
  const permissions = parsePermissions(body.permissions)
  if (isSuperAdminUsername(username)) return NextResponse.json({ error: 'Ese usuario está reservado' }, { status: 403 })
  if (!hasPermission(admin.permissions, 'users:permissions') || expandPermissions(permissions).some((p) => !hasPermission(admin.permissions, p))) {
    return NextResponse.json({ error: 'Solo puedes asignar permisos que posees y necesitas permiso para asignarlos' }, { status: 403 })
  }
  if (!permissions.length) return NextResponse.json({ error: 'Selecciona al menos un permiso' }, { status: 400 })
  try {
    const user = await db.adminUser.create({ data: { username, name, password: await hashPassword(password), permissions: JSON.stringify(permissions), active: true }, select: { id: true, username: true, name: true, permissions: true, active: true } })
    await auditLog({ action: 'create', entity: 'admin-user', entityId: user.id, admin: admin.name, details: `${username}: ${expandPermissions(permissions).join(', ')}` })
    return NextResponse.json({ ...user, permissions }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Ese usuario ya existe' }, { status: 409 })
  }
}
