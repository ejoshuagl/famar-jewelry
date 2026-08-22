import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'
import { issueAdminToken, auditLog } from '@/lib/admin-auth'

// Límite de intentos: 5 por IP por minuto
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  entry.count += 1
  return entry.count > 5
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })
    }

    const body = await request.json()
    const { username, password } = body

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const hashedInput = await hashPassword(password)
    const admin = await db.adminUser.findUnique({ where: { username } })

    if (!admin || admin.password !== hashedInput) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const name = admin.name || admin.username
    await auditLog({ action: 'login', entity: 'admin', admin: name, details: `Sesión iniciada (${ip})` })

    return NextResponse.json({
      name,
      username: admin.username,
      token: issueAdminToken(name),
    })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Internal server error', debug: String(error).slice(0, 300) }, { status: 500 })
  }
}
