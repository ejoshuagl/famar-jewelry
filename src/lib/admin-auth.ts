import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

// Clave para firmar tokens de sesión del admin.
function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET debe estar configurado')
  }
  return secret
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12 // 12 horas
export const ADMIN_PERMISSIONS = ['dashboard', 'products', 'orders', 'categories', 'campaigns', 'themes', 'wholesale', 'coupons', 'investments', 'users'] as const
export type AdminPermission = typeof ADMIN_PERMISSIONS[number]
export type AdminSession = { name: string; username?: string; permissions: AdminPermission[] | null }
export const isSuperAdminUsername = (username?: string | null) => username?.trim().toLowerCase() === 'joshua'

export function issueAdminToken(name: string, username?: string, permissions: AdminPermission[] | null = null): string {
  const payload = JSON.stringify({ name, username, permissions, exp: Date.now() + TOKEN_TTL_MS })
  const body = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyAdminToken(token: string | null): AdminSession | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = createHmac('sha256', sessionSecret()).update(body).digest()
  let received: Buffer
  try {
    received = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof payload.name !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((permission: unknown): permission is AdminPermission => ADMIN_PERMISSIONS.includes(permission as AdminPermission))
      : null
    return { name: payload.name, username: typeof payload.username === 'string' ? payload.username : undefined, permissions }
  } catch {
    return null
  }
}

/**
 * Verifica que la petición venga de un administrador autenticado.
 * El header x-admin-token es un token firmado emitido por /api/auth.
 * Devuelve el nombre del admin o null si no está autorizado.
 */
export async function requireAdmin(request: Request, permission?: AdminPermission): Promise<AdminSession | null> {
  const cookieToken = 'cookies' in request ? (request as import('next/server').NextRequest).cookies.get('famar-admin-session')?.value || null : null
  const session = verifyAdminToken(request.headers.get('x-admin-token') || cookieToken)
  if (!session?.username) return null
  const record = await db.adminUser.findUnique({
    where: { username: session.username },
    select: { username: true, name: true, permissions: true, active: true },
  })
  if (!record?.active) return null
  let permissions: AdminPermission[] | null = null
  try {
    permissions = record.permissions
      ? JSON.parse(record.permissions).filter((entry: unknown): entry is AdminPermission => ADMIN_PERMISSIONS.includes(entry as AdminPermission))
      : null
  } catch {
    permissions = []
  }
  const effectivePermissions = isSuperAdminUsername(record.username) ? null : permissions
  if (permission && effectivePermissions && !effectivePermissions.includes(permission)) return null
  return { username: record.username, name: record.name || record.username, permissions: effectivePermissions }
}

// ---- Registro de auditoría ----
export async function auditLog(entry: {
  action: string
  entity: string
  entityId?: string
  admin: string
  details?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        admin: entry.admin,
        details: entry.details?.slice(0, 500),
      },
    })
  } catch (error) {
    console.error('auditLog error:', error)
  }
}
