import { db } from '@/lib/db'

let storeEventsReady: Promise<void> | null = null

async function createStoreEventsTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoreEvent" (
      "id" TEXT PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "productId" TEXT,
      "campaignId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StoreEvent_type_createdAt_idx" ON "StoreEvent"("type", "createdAt")')
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StoreEvent_campaignId_createdAt_idx" ON "StoreEvent"("campaignId", "createdAt")')
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "StoreEvent_productId_createdAt_idx" ON "StoreEvent"("productId", "createdAt")')
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CartState" (
      "sessionId" TEXT PRIMARY KEY,
      "itemCount" INTEGER NOT NULL DEFAULT 0,
      "distinctCount" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CartState_updatedAt_idx" ON "CartState"("updatedAt")')
  await db.$executeRawUnsafe(`
    INSERT INTO "CommerceSetting" ("key", "value", "updatedAt")
    VALUES ('funnel_reset_at', TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO NOTHING
  `)
}

export function ensureStoreEventsTable() {
  storeEventsReady ||= createStoreEventsTable().catch((error) => {
    storeEventsReady = null
    throw error
  })
  return storeEventsReady
}
