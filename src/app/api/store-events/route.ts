import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureStoreEventsTable } from '@/lib/store-events'
import { auditLog, requireAdmin } from '@/lib/admin-auth'

const ALLOWED_TYPES = new Set(['product_view', 'add_to_cart', 'cart_view', 'checkout_started', 'order_created', 'whatsapp_opened', 'campaign_click'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const type = String(body.type || '')
    const sessionId = String(body.sessionId || '').slice(0, 100)
    if (type === 'cart_state' && sessionId) {
      await ensureStoreEventsTable()
      const itemCount = Math.max(0, Math.min(1000, Number.parseInt(String(body.itemCount || 0)) || 0))
      const distinctCount = Math.max(0, Math.min(1000, Number.parseInt(String(body.distinctCount || 0)) || 0))
      await db.$executeRaw`
        INSERT INTO "CartState" ("sessionId", "itemCount", "distinctCount", "updatedAt")
        VALUES (${sessionId}, ${itemCount}, ${distinctCount}, CURRENT_TIMESTAMP)
        ON CONFLICT ("sessionId") DO UPDATE SET "itemCount" = EXCLUDED."itemCount", "distinctCount" = EXCLUDED."distinctCount", "updatedAt" = CURRENT_TIMESTAMP
      `
      return new NextResponse(null, { status: 204 })
    }
    if (!ALLOWED_TYPES.has(type) || !sessionId) return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
    await ensureStoreEventsTable()
    await db.$executeRaw`
      INSERT INTO "StoreEvent" ("id", "sessionId", "type", "productId", "campaignId")
      VALUES (${randomUUID()}, ${sessionId}, ${type}, ${body.productId ? String(body.productId) : null}, ${body.campaignId ? String(body.campaignId) : null})
    `
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('POST /api/store-events error:', error)
    return NextResponse.json({ error: 'No se pudo registrar el evento' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = requireAdmin(request, 'dashboard')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await ensureStoreEventsTable()
  const resetAt = new Date()
  await db.commerceSetting.upsert({
    where: { key: 'funnel_reset_at' },
    update: { value: resetAt.toISOString() },
    create: { key: 'funnel_reset_at', value: resetAt.toISOString() },
  })
  await auditLog({
    action: 'reset',
    entity: 'store_funnel',
    admin: admin.name,
    details: `Nuevo inicio del embudo: ${resetAt.toISOString()}. El historial anterior se conservó.`,
  })
  return NextResponse.json({ success: true, resetAt, historyPreserved: true })
}
