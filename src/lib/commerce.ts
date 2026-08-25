import { db } from '@/lib/db'

export interface WholesaleTier { min: number; discount: number; label: string }
export interface CouponRecord {
  id: string; code: string; description: string | null; discount: number; minPurchase: number
  active: boolean; usageLimit: number | null; usageCount: number; startsAt: Date | null; endsAt: Date | null; createdAt: Date; updatedAt: Date
}

export const DEFAULT_WHOLESALE_TIERS: WholesaleTier[] = [
  { min: 50, discount: 10, label: '10% OFF automático' },
  { min: 100, discount: 20, label: '20% OFF + Atención personalizada' },
]

export async function ensureCommerceTables() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommerceSetting" (
      "key" TEXT NOT NULL, "value" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommerceSetting_pkey" PRIMARY KEY ("key")
    )
  `)
  await db.$executeRawUnsafe('ALTER TABLE "DiscountCoupon" ADD COLUMN IF NOT EXISTS "usageLimit" INTEGER')
  await db.$executeRawUnsafe('ALTER TABLE "DiscountCoupon" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0')
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DiscountCoupon" (
      "id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "discount" DOUBLE PRECISION NOT NULL,
      "minPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
      "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DiscountCoupon_pkey" PRIMARY KEY ("id"), CONSTRAINT "DiscountCoupon_code_key" UNIQUE ("code")
    )
  `)
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

export async function calculateDiscount(subtotal: number, couponCode?: string) {
  const tiers = await getWholesaleTiers()
  const wholesale = wholesaleDiscount(subtotal, tiers)
  const coupon = couponCode ? await findValidCoupon(couponCode, subtotal) : null
  const percent = Math.max(wholesale, coupon?.discount || 0)
  const source = coupon && coupon.discount > wholesale ? `Cupón ${coupon.code}` : wholesale > 0 ? 'Descuento mayorista' : null
  const amount = Math.round(subtotal * percent) / 100
  const appliedCoupon = coupon && coupon.discount > wholesale ? coupon.code : null
  return { subtotal, percent, amount, total: Math.max(0, subtotal - amount), source, coupon: appliedCoupon, validCoupon: coupon?.code || null, tiers }
}
