import 'server-only'

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'

function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

export async function consumePublicRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
) {
  const identity = createHash('sha256').update(`${scope}:${requestIp(request)}`).digest('hex')
  const key = `${scope}:${identity}`
  const cutoff = new Date(Date.now() - windowMs)
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "PublicRateLimit" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "PublicRateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "PublicRateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "PublicRateLimit"."windowStart" < ${cutoff} THEN CURRENT_TIMESTAMP ELSE "PublicRateLimit"."windowStart" END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count"
  `

  // Keep the shared limiter table bounded without adding work to every request.
  // Cleanup is intentionally probabilistic and deletes at most 500 stale rows.
  if (Math.random() < 0.01) {
    const staleBefore = new Date(Date.now() - Math.max(windowMs * 2, 24 * 60 * 60 * 1000))
    await db.$executeRaw`
      DELETE FROM "PublicRateLimit"
      WHERE ctid IN (
        SELECT ctid FROM "PublicRateLimit"
        WHERE "updatedAt" < ${staleBefore}
        ORDER BY "updatedAt" ASC
        LIMIT 500
      )
    `
  }
  return (rows[0]?.count || 1) <= limit
}
