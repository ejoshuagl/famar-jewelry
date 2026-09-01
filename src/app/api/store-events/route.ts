import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureStoreEventsTable } from '@/lib/store-events'

const ALLOWED_TYPES = new Set(['product_view', 'add_to_cart', 'cart_view', 'checkout_started', 'order_created', 'whatsapp_opened', 'campaign_click'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const type = String(body.type || '')
    const sessionId = String(body.sessionId || '').slice(0, 100)
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
