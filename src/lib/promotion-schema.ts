import 'server-only'

import { db } from '@/lib/db'

const globalSchema = globalThis as unknown as { promotionSchemaPromise?: Promise<void> }

export function ensurePromotionSchema() {
  if (!globalSchema.promotionSchemaPromise) {
    globalSchema.promotionSchemaPromise = (async () => {
      await db.$executeRawUnsafe('ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "couponId" text')
      await db.$executeRawUnsafe('ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "indefinite" boolean NOT NULL DEFAULT false')
      await db.$executeRawUnsafe('ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "campaignSource" text')
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public."CampaignInvestment" (
        "campaignId" text NOT NULL,
        "investmentId" text NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampaignInvestment_pkey" PRIMARY KEY ("campaignId", "investmentId")
      )`)
      await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CampaignInvestment_investmentId_idx" ON public."CampaignInvestment" ("investmentId")')
      await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_couponId_key" ON public."Campaign" ("couponId")')
      await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_campaignSource_createdAt_idx" ON public."Order" ("campaignSource", "createdAt")')
      await db.$executeRawUnsafe(`DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Campaign_couponId_fkey') THEN
            ALTER TABLE public."Campaign" ADD CONSTRAINT "Campaign_couponId_fkey"
              FOREIGN KEY ("couponId") REFERENCES public."DiscountCoupon"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignInvestment_campaignId_fkey') THEN
            ALTER TABLE public."CampaignInvestment" ADD CONSTRAINT "CampaignInvestment_campaignId_fkey"
              FOREIGN KEY ("campaignId") REFERENCES public."Campaign"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignInvestment_investmentId_fkey') THEN
            ALTER TABLE public."CampaignInvestment" ADD CONSTRAINT "CampaignInvestment_investmentId_fkey"
              FOREIGN KEY ("investmentId") REFERENCES public."Investment"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$`)
      await db.$executeRawUnsafe('ALTER TABLE public."CampaignInvestment" ENABLE ROW LEVEL SECURITY')
      await db.$executeRawUnsafe('REVOKE ALL ON TABLE public."CampaignInvestment" FROM anon, authenticated')
    })().catch((error) => {
      globalSchema.promotionSchemaPromise = undefined
      throw error
    })
  }
  return globalSchema.promotionSchemaPromise
}
