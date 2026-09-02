import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request, 'users')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(logs)
}
