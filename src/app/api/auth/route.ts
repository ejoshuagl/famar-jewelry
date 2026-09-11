import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/utils'
import { issueAdminToken, auditLog, isSuperAdminUsername, requireAdmin } from '@/lib/admin-auth'
import type { AdminPermission } from '@/lib/admin-auth'
import { consumePublicRateLimit } from '@/lib/public-rate-limit'

// Valid bcrypt hash used only to keep failed-login timing uniform when the
// requested administrative username does not exist.
const DUMMY_PASSWORD_HASH = '$2b$12$7K0DBB7Z7w6Q9itfRrZ8gOqmwNPWspjvbupJc7kPC7rDLYkXxZx2W'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    if (!await consumePublicRateLimit(request, 'admin-login', 10, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })
    }
    const recentFailures = await db.auditLog.count({ where: { action: 'login_failed', details: ip, createdAt: { gte: new Date(Date.now() - 60_000) } } })
    if (recentFailures >= 5) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })
    }

    const body = await request.json()
    const { username, password } = body

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const admin = await db.adminUser.findUnique({ where: { username } })
    const verification = await verifyPassword(password, admin?.password || DUMMY_PASSWORD_HASH)
    if (!admin || !admin.active || !verification.valid) {
      await auditLog({ action: 'login_failed', entity: 'admin', admin: 'Sistema', details: ip })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (verification.needsUpgrade) await db.adminUser.update({ where: { id: admin.id }, data: { password: await hashPassword(password) } })

    const name = admin.name || admin.username
    let permissions: AdminPermission[] | null = null
    try { permissions = admin.permissions ? JSON.parse(admin.permissions) : null } catch { permissions = [] }
    const effectivePermissions = isSuperAdminUsername(admin.username) ? null : permissions
    await auditLog({ action: 'login', entity: 'admin', admin: name, details: `Sesión iniciada (${ip})` })

    const response = NextResponse.json({
      name,
      username: admin.username,
      permissions: effectivePermissions,
      token: null,
    })
    response.cookies.set('famar-admin-session', issueAdminToken(name, admin.username, effectivePermissions), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 12 })
    return response
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json(admin, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('famar-admin-session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
  return response
}
