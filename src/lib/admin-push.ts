import 'server-only'
import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { db } from '@/lib/db'
import { hasPermission, readPermissions } from '@/lib/admin-permissions'
import { isSuperAdminUsername } from '@/lib/admin-auth'

// No polling, customer data, photos or paid messaging provider.
export function pushConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
  const subject = process.env.WEB_PUSH_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function endpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex')
}

export function validPushSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== 'object') return false
  const sub = value as webpush.PushSubscription
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) return false
  try {
    const url = new URL(sub.endpoint)
    // Prevent authenticated clients from using the sender as an SSRF proxy.
    const host = url.hostname
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return false
    if (!(host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com'))) return false
    return typeof sub.keys?.p256dh === 'string' && /^[A-Za-z0-9_-]+$/.test(sub.keys.p256dh)
      && Buffer.from(sub.keys.p256dh, 'base64url').length === 65
      && typeof sub.keys.auth === 'string' && /^[A-Za-z0-9_-]+$/.test(sub.keys.auth)
      && Buffer.from(sub.keys.auth, 'base64url').length === 16
  } catch { return false }
}

// Additive, transactional installation: never changes existing orders/products.
// The table is private from creation; failures roll the whole installation back.
let schemaPromise: Promise<void> | undefined
export function ensurePushSchema() {
  if (!schemaPromise) schemaPromise = db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('famar-admin-push-schema'))`
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public."AdminPushSubscription" (
      "id" text PRIMARY KEY, "adminId" text NOT NULL REFERENCES public."AdminUser"("id") ON DELETE CASCADE,
      "endpointHash" text NOT NULL UNIQUE, "endpoint" text NOT NULL,
      "p256dh" text NOT NULL, "auth" text NOT NULL, "vapidKey" text NOT NULL,
      "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminPushSubscription_adminId_idx" ON public."AdminPushSubscription" ("adminId")')
    await tx.$executeRawUnsafe('ALTER TABLE public."AdminPushSubscription" ENABLE ROW LEVEL SECURITY')
    await tx.$executeRawUnsafe('REVOKE ALL ON public."AdminPushSubscription" FROM anon, authenticated')
  }).catch((error) => { schemaPromise = undefined; throw error })
  return schemaPromise
}

export async function sendAdminPush(subscription: { endpoint: string; p256dh: string; auth: string }, tag: string, test = false) {
  const config = pushConfig()
  if (!config) throw new Error('PUSH_NOT_CONFIGURED')
  const sub = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }
  if (!validPushSubscription(sub)) throw new Error('PUSH_INVALID_ENDPOINT')
  await webpush.sendNotification(sub, JSON.stringify({
    title: test ? 'Notificaciones activadas' : 'Nuevo pedido en FAMAR',
    body: test ? 'Este dispositivo ya puede recibir avisos.' : 'Abre administración para revisar el pedido.',
    tag,
  }), { vapidDetails: config, TTL: 3600, timeout: 5000, urgency: 'normal', topic: endpointHash(tag).slice(0, 32) })
}

export async function notifyNewOrder(orderId: string) {
  if (!pushConfig()) return
  try {
    await ensurePushSchema()
    const subscriptions = await db.adminPushSubscription.findMany({
      take: 50, orderBy: { updatedAt: 'desc' },
      include: { admin: { select: { active: true, username: true, permissions: true } } },
    })
    for (let start = 0; start < subscriptions.length; start += 10) {
      await Promise.all(subscriptions.slice(start, start + 10).map(async (sub) => {
        const permitted = sub.admin.active && (isSuperAdminUsername(sub.admin.username) || hasPermission(readPermissions(sub.admin.permissions), 'orders:view'))
        if (!permitted || sub.vapidKey !== pushConfig()?.publicKey) {
          await db.adminPushSubscription.deleteMany({ where: { id: sub.id } })
          return
        }
        try {
          await sendAdminPush(sub, `order-${orderId}`)
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await db.adminPushSubscription.deleteMany({ where: { id: sub.id } })
          // Never log subscription URLs/keys or let an unavailable push provider fail checkout.
          else console.warn('Admin push delivery failed', { status: status || 'network' })
        }
      }))
    }
  } catch { console.warn('Admin push unavailable; order remains saved') }
}
