import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { ensureCampaignTable } from '@/lib/campaigns'

const ECUADOR_OFFSET = '-05:00'

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
    await ensureCampaignTable()
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get('all') === 'true'

    if (includeAll && !requireAdmin(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const campaigns = await db.campaign.findMany({
      where: includeAll ? undefined : {
        active: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: [{ priority: 'desc' }, { startAt: 'desc' }],
      include: { products: { select: { productId: true } } },
    })

    return NextResponse.json(campaigns.map((campaign) => ({
      ...campaign,
      productIds: campaign.products.map((product) => product.productId),
      products: undefined,
    })))
  } catch (error) {
    console.error('GET /api/campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCampaignTable()
    const admin = requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const startAt = parseEcuadorDate(body.startAt)
    const endAt = parseEcuadorDate(body.endAt)
    if (!body.title || !startAt || !endAt || endAt <= startAt) {
      return NextResponse.json({ error: 'Título o fechas inválidas' }, { status: 400 })
    }
    const displayMode = ['banner', 'popup', 'both'].includes(body.displayMode) ? body.displayMode : 'both'
    if ((displayMode === 'banner' || displayMode === 'both') && !body.bannerImage) return NextResponse.json({ error: 'Agrega la imagen horizontal del banner' }, { status: 400 })
    if ((displayMode === 'popup' || displayMode === 'both') && !body.popupImage) return NextResponse.json({ error: 'Agrega la imagen vertical de la publicidad flotante' }, { status: 400 })

    const productIds = Array.isArray(body.productIds)
      ? Array.from(new Set(body.productIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
      : []
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
        ctaView: body.ctaView || null,
        productIds: productIds.length ? JSON.stringify(productIds) : null,
        startAt,
        endAt,
        active: body.active !== false,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
        products: { create: productIds.map((productId) => ({ productId })) },
      },
      include: { products: { select: { productId: true } } },
    })
    await auditLog({ action: 'create', entity: 'campaign', entityId: campaign.id, admin: admin.name, details: campaign.title })
    return NextResponse.json({ ...campaign, productIds: campaign.products.map((product) => product.productId), products: undefined }, { status: 201 })
  } catch (error) {
    console.error('POST /api/campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
