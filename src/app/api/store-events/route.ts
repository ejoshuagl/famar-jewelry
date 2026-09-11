import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { consumePublicRateLimit } from '@/lib/public-rate-limit'

const ALLOWED_TYPES = new Set(['product_view', 'add_to_cart', 'cart_view', 'checkout_started', 'order_created', 'whatsapp_opened', 'campaign_click'])

export async function POST(request: NextRequest) {
  try {
    if (!await consumePublicRateLimit(request, 'store-event', 120, 60_000)) {
      return new NextResponse(null, { status: 429 })
    }
    const body = await request.json()
    const type = String(body.type || '')
    const sessionId = String(body.sessionId || '').slice(0, 100)
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)) return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 })
    const recentEvents = await db.storeEvent.count({ where: { sessionId, createdAt: { gte: new Date(Date.now() - 60_000) } } })
    if (recentEvents >= 60) return new NextResponse(null, { status: 429 })
    if (type === 'cart_state' && sessionId) {
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
  const admin = await requireAdmin(request, 'dashboard')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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
