import { db } from '@/lib/db'

let campaignTableReady: Promise<void> | null = null

async function createCampaignTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Campaign" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT,
      "image" TEXT,
      "placement" TEXT NOT NULL DEFAULT 'popup',
      "ctaLabel" TEXT,
      "ctaView" TEXT,
      "productIds" TEXT,
      "startAt" TIMESTAMP(3) NOT NULL,
      "endAt" TIMESTAMP(3) NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
    )
  `)
  await db.$executeRawUnsafe('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "productIds" TEXT')
  await db.$executeRawUnsafe('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "bannerImage" TEXT')
  await db.$executeRawUnsafe('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "popupImage" TEXT')
  await db.$executeRawUnsafe('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "displayMode" TEXT NOT NULL DEFAULT \'both\'')
  await db.$executeRawUnsafe(`UPDATE "Campaign" SET "bannerImage" = "image", "displayMode" = 'banner' WHERE "placement" = 'banner' AND "bannerImage" IS NULL`)
  await db.$executeRawUnsafe(`UPDATE "Campaign" SET "popupImage" = "image", "displayMode" = 'popup' WHERE "placement" = 'popup' AND "popupImage" IS NULL`)
  await db.$executeRawUnsafe(`
    UPDATE "Campaign" AS popup
    SET "bannerImage" = banner."bannerImage", "displayMode" = 'both', "updatedAt" = CURRENT_TIMESTAMP
    FROM "Campaign" AS banner
    WHERE popup."displayMode" = 'popup' AND banner."displayMode" = 'banner'
      AND popup."startAt" = banner."startAt" AND popup."endAt" = banner."endAt"
      AND COALESCE(popup."productIds", '') = COALESCE(banner."productIds", '')
      AND popup."bannerImage" IS NULL AND banner."bannerImage" IS NOT NULL
  `)
  await db.$executeRawUnsafe(`
    DELETE FROM "Campaign" AS banner
    WHERE banner."displayMode" = 'banner' AND EXISTS (
      SELECT 1 FROM "Campaign" AS combined
      WHERE combined."displayMode" = 'both' AND combined."startAt" = banner."startAt" AND combined."endAt" = banner."endAt"
        AND COALESCE(combined."productIds", '') = COALESCE(banner."productIds", '')
        AND combined."bannerImage" = banner."bannerImage"
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Campaign_active_startAt_endAt_idx"
    ON "Campaign"("active", "startAt", "endAt")
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CampaignProduct" (
      "campaignId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CampaignProduct_pkey" PRIMARY KEY ("campaignId", "productId"),
      CONSTRAINT "CampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
      CONSTRAINT "CampaignProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
    )
  `)
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CampaignProduct_productId_idx" ON "CampaignProduct"("productId")')
  await db.$executeRawUnsafe(`
    INSERT INTO "CampaignProduct" ("campaignId", "productId")
    SELECT campaign."id", selected."productId"
    FROM "Campaign" AS campaign
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN campaign."productIds" IS NULL OR BTRIM(campaign."productIds") = '' THEN '[]'::jsonb ELSE campaign."productIds"::jsonb END
    ) AS selected("productId")
    JOIN "Product" ON "Product"."id" = selected."productId"
    ON CONFLICT ("campaignId", "productId") DO NOTHING
  `)
  await db.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "campaignId" TEXT')
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_campaignId_createdAt_idx" ON "Order"("campaignId", "createdAt")')
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_campaignId_fkey') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `)
}

export function ensureCampaignTable() {
  campaignTableReady ||= createCampaignTable().catch((error) => {
    campaignTableReady = null
    throw error
  })
  return campaignTableReady
}
