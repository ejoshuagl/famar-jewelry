import { NextRequest, NextResponse } from 'next/server'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureCommerceTables } from '@/lib/commerce'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request); if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await ensureCommerceTables(); const { id } = await params; const body = await request.json()
  const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
  const discount = Number(body.discount); const minPurchase = Number(body.minPurchase || 0)
  if (!code || discount <= 0 || discount > 90 || minPurchase < 0) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `UPDATE "DiscountCoupon" SET "code"=$2,"description"=$3,"discount"=$4,"minPurchase"=$5,"active"=$6,"startsAt"=$7,"endsAt"=$8,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *`,
    id, code, String(body.description || '').slice(0, 200) || null, discount, minPurchase, body.active !== false, body.startsAt ? new Date(body.startsAt) : null, body.endsAt ? new Date(body.endsAt) : null,
  )
  if (!rows[0]) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await auditLog({ action: 'update', entity: 'coupon', entityId: id, admin: admin.name, details: code }); return NextResponse.json(rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request); if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await ensureCommerceTables(); const { id } = await params
  await db.$executeRawUnsafe('DELETE FROM "DiscountCoupon" WHERE "id"=$1', id)
  await auditLog({ action: 'delete', entity: 'coupon', entityId: id, admin: admin.name }); return NextResponse.json({ success: true })
}
