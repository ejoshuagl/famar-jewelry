import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { endpointHash, ensurePushSchema, pushConfig, sendAdminPush, validPushSubscription } from '@/lib/admin-push'
import { consumePublicRateLimit } from '@/lib/public-rate-limit'

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request, 'orders:view')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ publicKey: pushConfig()?.publicKey || null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request, 'orders:view')
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
    if (!await consumePublicRateLimit(request, 'admin-push', 30, 60_000)) return NextResponse.json({ error: 'Espera un minuto antes de reintentar' }, { status: 429 })
    const raw = await request.text()
    if (raw.length > 4096) return NextResponse.json({ error: 'Solicitud demasiado grande' }, { status: 400 })
    let body
    try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
    if (!body || !['enable', 'disable', 'status', 'test'].includes(body.action) || !validPushSubscription(body.subscription)) return NextResponse.json({ error: 'Suscripción inválida o navegador no compatible' }, { status: 400 })
    const config = pushConfig()
    if (!config) return NextResponse.json({ error: 'Las notificaciones aún no están configuradas en el servidor' }, { status: 503 })
    await ensurePushSchema()
    const owner = await db.adminUser.findUniqueOrThrow({ where: { username: admin.username! }, select: { id: true } })
    const hash = endpointHash(body.subscription.endpoint)
    const existing = await db.adminPushSubscription.findUnique({ where: { endpointHash: hash } })
    if (body.action === 'status') return NextResponse.json({ active: existing?.adminId === owner.id && existing?.vapidKey === config.publicKey }, { headers: { 'Cache-Control': 'no-store' } })
    if (body.action === 'disable') {
      await db.adminPushSubscription.deleteMany({ where: { endpointHash: hash, adminId: owner.id } })
      await auditLog({ action: 'update', entity: 'admin', entityId: owner.id, admin: admin.name, details: 'Notificaciones desactivadas en un dispositivo' })
      return NextResponse.json({ active: false })
    }
    if (body.action === 'test') {
      if (existing?.adminId !== owner.id) return NextResponse.json({ error: 'Activa primero este dispositivo' }, { status: 403 })
      await sendAdminPush(existing, 'famar-push-test', true)
      return NextResponse.json({ sent: true })
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('famar-push-register'))`
      const current = await tx.adminPushSubscription.findUnique({ where: { endpointHash: hash } })
      // A shared browser is bound to the last administrator who explicitly enables it.
      if (current?.adminId !== owner.id && await tx.adminPushSubscription.count({ where: { adminId: owner.id } }) >= 5) throw new Error('PUSH_DEVICE_LIMIT')
      if (!current && await tx.adminPushSubscription.count() >= 50) throw new Error('PUSH_DEVICE_LIMIT')
      await tx.adminPushSubscription.upsert({ where: { endpointHash: hash },
        create: { endpointHash: hash, endpoint: body.subscription.endpoint, adminId: owner.id, p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth, vapidKey: config.publicKey },
        update: { adminId: owner.id, p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth, vapidKey: config.publicKey },
      })
    })
    await auditLog({ action: 'update', entity: 'admin', entityId: owner.id, admin: admin.name, details: 'Notificaciones activadas en un dispositivo' })
    return NextResponse.json({ active: true })
  } catch (error) {
    const limit = error instanceof Error && error.message === 'PUSH_DEVICE_LIMIT'
    return NextResponse.json({ error: limit ? 'Límite de dispositivos alcanzado. Desactiva uno antes de agregar otro.' : 'No se pudo completar la operación. Inténtalo otra vez.' }, { status: limit ? 409 : 503 })
  }
}
