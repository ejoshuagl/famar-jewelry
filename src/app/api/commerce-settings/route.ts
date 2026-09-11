import { NextRequest, NextResponse } from 'next/server'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { getSaleDiscount, getWholesaleTiers, saveSaleDiscount, saveWholesaleTiers, type WholesaleTier } from '@/lib/commerce'
import { getDailySaleSelection, getDailySaleSettings, saveDailySaleSettings } from '@/lib/daily-sales'

export async function GET(request: NextRequest) {
  const [tiers, saleDiscount, dailySale] = await Promise.all([getWholesaleTiers(), getSaleDiscount(), getDailySaleSettings()])
  const admin = new URL(request.url).searchParams.get('admin') === 'true' ? await requireAdmin(request, 'wholesale') : null
  const selection = admin ? await getDailySaleSelection(dailySale) : null
  return NextResponse.json({ tiers, saleDiscount, dailySale, ...(selection ? { dailySaleProducts: selection.products, dailySaleDate: selection.date } : {}) }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request, 'wholesale')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json()
  const tiers = (Array.isArray(body.tiers) ? body.tiers : []).map((tier: WholesaleTier) => ({
    min: Math.max(0, Number(tier.min)), discount: Math.min(90, Math.max(0, Number(tier.discount))), label: String(tier.label || '').slice(0, 100),
  })).filter((tier: WholesaleTier) => Number.isFinite(tier.min) && Number.isFinite(tier.discount)).sort((a: WholesaleTier, b: WholesaleTier) => a.min - b.min)
  if (!tiers.length) return NextResponse.json({ error: 'Configura al menos un nivel' }, { status: 400 })
  const saleDiscount = Math.min(90, Math.max(0, Number(body.saleDiscount ?? 25)))
  const previousDailySale = await getDailySaleSettings()
  const dailySale = {
    active: body.dailySale?.active === true,
    count: Math.min(100, Math.max(1, Number.parseInt(String(body.dailySale?.count)) || 25)),
    categoryIds: Array.isArray(body.dailySale?.categoryIds) ? body.dailySale.categoryIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100) : [],
    rotation: body.rotateDailySale === true ? previousDailySale.rotation + 1 : previousDailySale.rotation,
    campaignId: previousDailySale.campaignId,
  }
  await Promise.all([saveWholesaleTiers(tiers), saveSaleDiscount(saleDiscount), saveDailySaleSettings(dailySale)])
  const selection = await getDailySaleSelection(dailySale)
  await auditLog({ action: 'update', entity: 'wholesale', admin: admin.name, details: `Mayoristas y oferta diaria: activa=${dailySale.active}, cantidad=${dailySale.count}, descuento=${saleDiscount}%` })
  return NextResponse.json({ tiers, saleDiscount, dailySale, dailySaleProducts: selection.products, dailySaleDate: selection.date })
}
