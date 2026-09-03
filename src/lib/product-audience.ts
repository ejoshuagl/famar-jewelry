import { db } from '@/lib/db'

let audienceColumnReady: Promise<void> | null = null

async function createProductAudienceColumn() {
  await db.$executeRawUnsafe(
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isForMen" BOOLEAN NOT NULL DEFAULT false'
  )
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Product_isForMen_visible_idx" ON "Product" ("isForMen", "visible")'
  )
}

export function ensureProductAudienceColumn() {
  if (!audienceColumnReady) {
    audienceColumnReady = createProductAudienceColumn().catch((error) => {
      audienceColumnReady = null
      throw error
    })
  }
  return audienceColumnReady
}
