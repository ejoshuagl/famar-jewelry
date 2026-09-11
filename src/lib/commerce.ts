import { db } from '@/lib/db'
import { DEFAULT_SALE_DISCOUNT, money } from '@/lib/pricing'

export interface WholesaleTier { min: number; discount: number; label: string }
export interface CouponRecord {
  id: string; code: string; description: string | null; discount: number; minPurchase: number
  active: boolean; usageLimit: number | null; usageCount: number; startsAt: Date | null; endsAt: Date | null; createdAt: Date; updatedAt: Date
}

export const DEFAULT_WHOLESALE_TIERS: WholesaleTier[] = [
  { min: 50, discount: 10, label: '10% OFF automático' },
  { min: 100, discount: 20, label: '20% OFF + Atención personalizada' },
]

export async function getWholesaleTiers(): Promise<WholesaleTier[]> {
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>('SELECT "value" FROM "CommerceSetting" WHERE "key" = $1', 'wholesale-tiers')
  if (!rows[0]) return DEFAULT_WHOLESALE_TIERS
  try {
    const parsed = JSON.parse(rows[0].value)
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WHOLESALE_TIERS
  } catch { return DEFAULT_WHOLESALE_TIERS }
}

export async function saveWholesaleTiers(tiers: WholesaleTier[]) {
  await db.$executeRawUnsafe(
    `INSERT INTO "CommerceSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'wholesale-tiers', JSON.stringify(tiers),
  )
}

export async function getSaleDiscount() {
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>('SELECT "value" FROM "CommerceSetting" WHERE "key" = $1', 'sale-discount')
  const value = Number(rows[0]?.value ?? DEFAULT_SALE_DISCOUNT)
  return Number.isFinite(value) ? Math.min(90, Math.max(0, value)) : DEFAULT_SALE_DISCOUNT
}

export async function saveSaleDiscount(discount: number) {
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
  const rows = await db.$queryRawUnsafe<CouponRecord[]>(
    `SELECT * FROM "DiscountCoupon" WHERE UPPER("code") = UPPER($1) AND "active" = true
     AND "minPurchase" <= $2 AND ("startsAt" IS NULL OR "startsAt" <= CURRENT_TIMESTAMP)
     AND ("endsAt" IS NULL OR "endsAt" >= CURRENT_TIMESTAMP)
     AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit") LIMIT 1`, code.trim(), subtotal,
  )
  return rows[0] || null
}

export async function calculateDiscount(eligibleSubtotal: number, couponCode?: string, saleSubtotal = 0, includeWholesale = true) {
  const tiers = await getWholesaleTiers()
  const wholesale = includeWholesale ? wholesaleDiscount(eligibleSubtotal, tiers) : 0
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
