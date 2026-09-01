import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'
import { ADMIN_PERMISSIONS, auditLog, requireAdmin, type AdminPermission } from '@/lib/admin-auth'
import { ensureAdminUserPermissions } from '@/lib/admin-users'

function parsePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((entry): entry is AdminPermission => ADMIN_PERMISSIONS.includes(entry as AdminPermission)))]
}

export async function GET(request: NextRequest) {
  await ensureAdminUserPermissions()
  const admin = requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const users = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, username: true, name: true, permissions: true, active: true, createdAt: true } })
  return NextResponse.json(users.map((user) => ({ ...user, permissions: user.permissions ? JSON.parse(user.permissions) : null })))
}

export async function POST(request: NextRequest) {
  await ensureAdminUserPermissions()
  const admin = requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json()
  const username = String(body.username || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const password = String(body.password || '')
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || name.length < 2 || password.length < 8) {
    return NextResponse.json({ error: 'Revisa el nombre, usuario y contraseña (mínimo 8 caracteres)' }, { status: 400 })
  }
  const permissions = parsePermissions(body.permissions)
  if (!permissions.length) return NextResponse.json({ error: 'Selecciona al menos un permiso' }, { status: 400 })
  try {
    const user = await db.adminUser.create({ data: { username, name, password: await hashPassword(password), permissions: JSON.stringify(permissions), active: true }, select: { id: true, username: true, name: true, permissions: true, active: true } })
    await auditLog({ action: 'create', entity: 'admin-user', entityId: user.id, admin: admin.name, details: username })
    return NextResponse.json({ ...user, permissions }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Ese usuario ya existe' }, { status: 409 })
  }
}
