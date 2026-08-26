import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureCommerceTables } from '@/lib/commerce'

export async function GET(request: NextRequest) {
  const admin = requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const coupons = await db.$queryRawUnsafe('SELECT * FROM "DiscountCoupon" ORDER BY "createdAt" DESC')
  return NextResponse.json({ coupons })
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await ensureCommerceTables()
  const body = await request.json()
  const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
  const discount = Number(body.discount); const minPurchase = Number(body.minPurchase || 0)
  const usageLimit = body.unlimited !== false ? null : Math.max(1, Math.floor(Number(body.usageLimit || 1)))
  if (!code || !Number.isFinite(discount) || discount <= 0 || discount > 90 || !Number.isFinite(minPurchase) || minPurchase < 0) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `INSERT INTO "DiscountCoupon" ("id","code","description","discount","minPurchase","active","startsAt","endsAt","usageLimit","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP) RETURNING *`, randomUUID(), code, String(body.description || '').slice(0, 200) || null,
      discount, minPurchase, body.active !== false, body.startsAt ? new Date(body.startsAt) : null, body.endsAt ? new Date(body.endsAt) : null, usageLimit,
    )
    await auditLog({ action: 'create', entity: 'coupon', entityId: String(rows[0].id), admin: admin.name, details: code })
    return NextResponse.json(rows[0], { status: 201 })
  } catch { return NextResponse.json({ error: 'El código ya existe o las fechas son inválidas' }, { status: 400 }) }
}
