import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const hashedInput = await hashPassword(password)
    const admin = await db.adminUser.findUnique({ where: { username } })

    if (!admin || admin.password !== hashedInput) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    return NextResponse.json({
      name: admin.name || admin.username,
      username: admin.username,
    })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}