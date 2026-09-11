import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { getDailySaleSettings, saveDailySaleSettings } from '@/lib/daily-sales'
import { ensurePromotionSchema } from '@/lib/promotion-schema'

const ECUADOR_OFFSET = '-05:00'
const ALLOWED_CTA_VIEWS = new Set(['home', 'catalog', 'out-of-stock', 'jewelry-care', 'contact', 'favorites', 'cart', 'policies'])

function parseEcuadorDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const normalized = value.includes('T') && !/[zZ]|[+-]\d\d:\d\d$/.test(value)
    ? `${value}:00${ECUADOR_OFFSET}`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  try {
    await ensurePromotionSchema()
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get('all') === 'true'
    const validateId = searchParams.get('validate') || ''

    if (validateId) {
      const now = new Date()
      const campaign = await db.campaign.findUnique({
        where: { id: validateId },
        select: {
          active: true,
          startAt: true,
          endAt: true,
          indefinite: true,
          coupon: { select: { code: true, discount: true, active: true, startsAt: true, endsAt: true, usageLimit: true, usageCount: true } },
        },
      })
      const campaignValid = Boolean(campaign?.active)
        && Boolean(campaign && campaign.startAt <= now)
        && Boolean(campaign && (campaign.indefinite || campaign.endAt >= now))
      const coupon = campaign?.coupon
      const couponValid = campaignValid && Boolean(coupon?.active)
        && Boolean(coupon && (!coupon.startsAt || coupon.startsAt <= now))
        && Boolean(coupon && (!coupon.endsAt || coupon.endsAt >= now))
        && Boolean(coupon && (coupon.usageLimit == null || coupon.usageCount < coupon.usageLimit))
      return NextResponse.json({
        campaignValid,
        couponValid,
        coupon: couponValid && coupon ? { code: coupon.code, discount: coupon.discount } : null,
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
    }

    if (includeAll && !await requireAdmin(request, 'campaigns')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const [campaigns, dailySale] = await Promise.all([db.campaign.findMany({
      where: includeAll ? undefined : {
        active: true,
        startAt: { lte: now },
        OR: [{ indefinite: true }, { endAt: { gte: now } }],
      },
      orderBy: [{ priority: 'desc' }, { startAt: 'desc' }],
      include: {
        products: { select: { productId: true } },
        investments: { select: { investmentId: true, investment: { select: { description: true, purchasedAt: true } } } },
        coupon: { select: { id: true, code: true, discount: true } },
      },
    }), getDailySaleSettings()])

    const performance = new Map<string, { clicks: number; cartAdds: number; orders: number; confirmedOrders: number; revenue: number; couponOrders: number; dailySaleOrders: number }>()
    if (includeAll) {
      const [eventRows, orderRows] = await Promise.all([
        db.$queryRaw<Array<{ campaignId: string; clicks: number; cartAdds: number }>>`
          SELECT "campaignId",
            COUNT(*) FILTER (WHERE type = 'campaign_click')::int AS clicks,
            COUNT(*) FILTER (WHERE type = 'add_to_cart')::int AS "cartAdds"
          FROM "StoreEvent" WHERE "campaignId" IS NOT NULL GROUP BY "campaignId"
        `,
        db.$queryRaw<Array<{ campaignId: string; orders: number; confirmedOrders: number; revenue: number; couponOrders: number; dailySaleOrders: number }>>`
          SELECT "campaignId", COUNT(*)::int AS orders,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int AS "confirmedOrders",
            COUNT(*) FILTER (WHERE "campaignSource" = 'coupon')::int AS "couponOrders",
            COUNT(*) FILTER (WHERE "campaignSource" = 'daily_sale')::int AS "dailySaleOrders",
            COALESCE(SUM(total) FILTER (WHERE status = 'confirmed'), 0)::float8 AS revenue
          FROM "Order" WHERE "campaignId" IS NOT NULL GROUP BY "campaignId"
        `,
      ])
      for (const row of eventRows) performance.set(row.campaignId, { clicks: row.clicks, cartAdds: row.cartAdds, orders: 0, confirmedOrders: 0, revenue: 0, couponOrders: 0, dailySaleOrders: 0 })
      for (const row of orderRows) performance.set(row.campaignId, { ...(performance.get(row.campaignId) || { clicks: 0, cartAdds: 0 }), orders: row.orders, confirmedOrders: row.confirmedOrders, revenue: row.revenue, couponOrders: row.couponOrders, dailySaleOrders: row.dailySaleOrders })
    }

    return NextResponse.json(campaigns.map((campaign) => ({
      ...campaign,
      productIds: campaign.products.map((product) => product.productId),
      investmentIds: campaign.investments.map((row) => row.investmentId),
      investmentLabels: campaign.investments.map((row) => ({ id: row.investmentId, description: row.investment.description, purchasedAt: row.investment.purchasedAt })),
      products: undefined,
      investments: undefined,
      dailySaleLinked: dailySale.campaignId === campaign.id,
      performance: includeAll ? (performance.get(campaign.id) || { clicks: 0, cartAdds: 0, orders: 0, confirmedOrders: 0, revenue: 0, couponOrders: 0, dailySaleOrders: 0 }) : undefined,
    })), includeAll ? undefined : {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('GET /api/campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePromotionSchema()
    const admin = await requireAdmin(request, 'campaigns')
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const startAt = parseEcuadorDate(body.startAt)
    const indefinite = body.indefinite === true
    const endAt = indefinite ? new Date('2099-12-31T23:59:59-05:00') : parseEcuadorDate(body.endAt)
    if (!body.title || !startAt || !endAt || endAt <= startAt) {
      return NextResponse.json({ error: 'Título o fechas inválidas' }, { status: 400 })
    }
    const displayMode = ['banner', 'popup', 'both'].includes(body.displayMode) ? body.displayMode : 'both'
    const ctaView = body.ctaView == null || body.ctaView === '' ? null : String(body.ctaView)
    if (ctaView && !ALLOWED_CTA_VIEWS.has(ctaView)) {
      return NextResponse.json({ error: 'Destino de campaña inválido' }, { status: 400 })
    }
    if ((displayMode === 'banner' || displayMode === 'both') && !body.bannerImage) return NextResponse.json({ error: 'Agrega la imagen horizontal del banner' }, { status: 400 })
    if ((displayMode === 'popup' || displayMode === 'both') && !body.popupImage) return NextResponse.json({ error: 'Agrega la imagen vertical de la publicidad flotante' }, { status: 400 })

    const productIds: string[] = Array.isArray(body.productIds)
      ? Array.from(new Set(body.productIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
      : []
    const couponId = typeof body.couponId === 'string' && body.couponId ? body.couponId : null
    const investmentIds: string[] = Array.isArray(body.investmentIds)
      ? Array.from(new Set(body.investmentIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
      : []
    if (couponId && !await db.discountCoupon.findUnique({ where: { id: couponId }, select: { id: true } })) return NextResponse.json({ error: 'Cupón inválido' }, { status: 400 })
    if (investmentIds.length && await db.investment.count({ where: { id: { in: investmentIds } } }) !== investmentIds.length) return NextResponse.json({ error: 'Una importación seleccionada ya no existe' }, { status: 400 })
    const campaign = await db.campaign.create({
      data: {
        title: String(body.title).slice(0, 120),
        message: body.message ? String(body.message).slice(0, 500) : null,
        image: body.image || null,
        placement: displayMode === 'banner' ? 'banner' : 'popup',
        bannerImage: body.bannerImage || null,
        popupImage: body.popupImage || null,
        displayMode,
        ctaLabel: body.ctaLabel ? String(body.ctaLabel).slice(0, 40) : null,
        ctaView,
        productIds: productIds.length ? JSON.stringify(productIds) : null,
        startAt,
        endAt,
        indefinite,
        active: body.active !== false,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
        couponId,
        products: { create: productIds.map((productId) => ({ productId })) },
        investments: { create: investmentIds.map((investmentId) => ({ investmentId })) },
      },
      include: { products: { select: { productId: true } }, investments: { select: { investmentId: true } }, coupon: { select: { id: true, code: true, discount: true } } },
    })
    if (body.dailySaleLinked === true) {
      const dailySale = await getDailySaleSettings()
      await saveDailySaleSettings({ ...dailySale, campaignId: campaign.id })
    }
    await auditLog({ action: 'create', entity: 'campaign', entityId: campaign.id, admin: admin.name, details: campaign.title })
    return NextResponse.json({ ...campaign, productIds: campaign.products.map((product) => product.productId), investmentIds: campaign.investments.map((row) => row.investmentId), products: undefined, investments: undefined }, { status: 201 })
  } catch (error) {
    console.error('POST /api/campaigns error:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) return NextResponse.json({ error: 'Ese cupón ya está asociado con otra campaña' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
