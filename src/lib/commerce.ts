import { db } from '@/lib/db'
import { DEFAULT_SALE_DISCOUNT, money } from '@/lib/pricing'

export interface WholesaleTier { min: number; discount: number; label: string }
export interface CouponRecord {
  id: string; code: string; description: string | null; discount: number; minPurchase: number
  active: boolean; usageLimit: number | null; usageCount: number; startsAt: Date | null; endsAt: Date | null; createdAt: Date; updatedAt: Date
}

let commerceTablesReady: Promise<void> | null = null

export const DEFAULT_WHOLESALE_TIERS: WholesaleTier[] = [
  { min: 50, discount: 10, label: '10% OFF automático' },
  { min: 100, discount: 20, label: '20% OFF + Atención personalizada' },
]

async function createCommerceTables() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommerceSetting" (
      "key" TEXT NOT NULL, "value" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommerceSetting_pkey" PRIMARY KEY ("key")
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DiscountCoupon" (
      "id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "discount" DOUBLE PRECISION NOT NULL,
      "minPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
      "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DiscountCoupon_pkey" PRIMARY KEY ("id"), CONSTRAINT "DiscountCoupon_code_key" UNIQUE ("code")
    )
  `)
  await db.$executeRawUnsafe('ALTER TABLE "DiscountCoupon" ADD COLUMN IF NOT EXISTS "usageLimit" INTEGER')
  await db.$executeRawUnsafe('ALTER TABLE "DiscountCoupon" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0')
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CouponRedemption" (
      "id" TEXT NOT NULL,
      "couponId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "customerPhone" TEXT NOT NULL,
      "discount" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "CouponRedemption_orderId_key" UNIQUE ("orderId"),
      CONSTRAINT "CouponRedemption_couponId_customerPhone_key" UNIQUE ("couponId", "customerPhone"),
      CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "DiscountCoupon"("id") ON DELETE RESTRICT,
      CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE
    )
  `)
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_createdAt_idx" ON "CouponRedemption"("couponId", "createdAt")')
  await db.$executeRawUnsafe(`
    INSERT INTO "CouponRedemption" ("id", "couponId", "orderId", "customerPhone", "discount", "createdAt")
    SELECT DISTINCT ON (coupon."id", orders."customerPhone")
      md5(coupon."id" || orders."id"), coupon."id", orders."id", orders."customerPhone", coupon."discount", orders."createdAt"
    FROM "DiscountCoupon" AS coupon
    JOIN "Order" AS orders ON orders."observations" ILIKE ('%[Cupón ' || coupon."code" || ':%')
    ORDER BY coupon."id", orders."customerPhone", orders."createdAt"
    ON CONFLICT DO NOTHING
  `)
  await db.$executeRawUnsafe(`
    UPDATE "DiscountCoupon" AS coupon SET "usageCount" = GREATEST(coupon."usageCount", redemptions.total)
    FROM (SELECT "couponId", COUNT(*)::integer AS total FROM "CouponRedemption" GROUP BY "couponId") AS redemptions
    WHERE coupon."id" = redemptions."couponId"
  `)
}

export function ensureCommerceTables() {
  commerceTablesReady ||= createCommerceTables().catch((error) => {
    commerceTablesReady = null
    throw error
  })
  return commerceTablesReady
}

export async function getWholesaleTiers(): Promise<WholesaleTier[]> {
  await ensureCommerceTables()
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>('SELECT "value" FROM "CommerceSetting" WHERE "key" = $1', 'wholesale-tiers')
  if (!rows[0]) return DEFAULT_WHOLESALE_TIERS
  try {
    const parsed = JSON.parse(rows[0].value)
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WHOLESALE_TIERS
  } catch { return DEFAULT_WHOLESALE_TIERS }
}

export async function saveWholesaleTiers(tiers: WholesaleTier[]) {
  await ensureCommerceTables()
  await db.$executeRawUnsafe(
    `INSERT INTO "CommerceSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'wholesale-tiers', JSON.stringify(tiers),
  )
}

export async function getSaleDiscount() {
  await ensureCommerceTables()
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>('SELECT "value" FROM "CommerceSetting" WHERE "key" = $1', 'sale-discount')
  const value = Number(rows[0]?.value ?? DEFAULT_SALE_DISCOUNT)
  return Number.isFinite(value) ? Math.min(90, Math.max(0, value)) : DEFAULT_SALE_DISCOUNT
}

export async function saveSaleDiscount(discount: number) {
  await ensureCommerceTables()
  const safeDiscount = Math.min(90, Math.max(0, Number(discount)))
  await db.$executeRawUnsafe(
    `INSERT INTO "CommerceSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'sale-discount', String(safeDiscount),
  )
  return safeDiscount
}

export function wholesaleDiscount(subtotal: number, tiers: WholesaleTier[]) {
  return tiers.filter((tier) => subtotal >= tier.min).reduce((best, tier) => Math.max(best, tier.discount), 0)
}

export async function findValidCoupon(code: string, subtotal: number): Promise<CouponRecord | null> {
  await ensureCommerceTables()
  const rows = await db.$queryRawUnsafe<CouponRecord[]>(
    `SELECT * FROM "DiscountCoupon" WHERE UPPER("code") = UPPER($1) AND "active" = true
     AND "minPurchase" <= $2 AND ("startsAt" IS NULL OR "startsAt" <= CURRENT_TIMESTAMP)
     AND ("endsAt" IS NULL OR "endsAt" >= CURRENT_TIMESTAMP)
     AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit") LIMIT 1`, code.trim(), subtotal,
  )
  return rows[0] || null
}

export async function calculateDiscount(eligibleSubtotal: number, couponCode?: string, saleSubtotal = 0) {
  const tiers = await getWholesaleTiers()
  const wholesale = wholesaleDiscount(eligibleSubtotal, tiers)
  const coupon = couponCode ? await findValidCoupon(couponCode, eligibleSubtotal) : null
  const percent = Math.max(wholesale, coupon?.discount || 0)
  const source = coupon && coupon.discount > wholesale ? `Cupón ${coupon.code}` : wholesale > 0 ? 'Descuento mayorista' : null
  const amount = money(eligibleSubtotal * percent / 100)
  const appliedCoupon = coupon && coupon.discount > wholesale ? coupon.code : null
  const subtotal = money(eligibleSubtotal + saleSubtotal)
  return {
    subtotal,
    eligibleSubtotal: money(eligibleSubtotal),
    saleSubtotal: money(saleSubtotal),
    percent,
    amount,
    total: money(Math.max(0, eligibleSubtotal - amount) + saleSubtotal),
    source,
    coupon: appliedCoupon,
    couponId: appliedCoupon ? coupon?.id || null : null,
    validCoupon: coupon?.code || null,
    tiers,
  }
}
