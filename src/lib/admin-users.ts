import { db } from '@/lib/db'

let ready: Promise<void> | null = null

export function ensureAdminUserPermissions() {
  ready ||= db.$transaction([
    db.$executeRawUnsafe('ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "permissions" TEXT'),
    db.$executeRawUnsafe('ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true'),
  ]).then(() => undefined).catch((error) => { ready = null; throw error })
  return ready
}
