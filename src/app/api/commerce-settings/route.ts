import { NextRequest, NextResponse } from 'next/server'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { getSaleDiscount, getWholesaleTiers, saveSaleDiscount, saveWholesaleTiers, type WholesaleTier } from '@/lib/commerce'

export async function GET() {
  const [tiers, saleDiscount] = await Promise.all([getWholesaleTiers(), getSaleDiscount()])
  return NextResponse.json({ tiers, saleDiscount })
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json()
  const tiers = (Array.isArray(body.tiers) ? body.tiers : []).map((tier: WholesaleTier) => ({
    min: Math.max(0, Number(tier.min)), discount: Math.min(90, Math.max(0, Number(tier.discount))), label: String(tier.label || '').slice(0, 100),
  })).filter((tier: WholesaleTier) => Number.isFinite(tier.min) && Number.isFinite(tier.discount)).sort((a: WholesaleTier, b: WholesaleTier) => a.min - b.min)
  if (!tiers.length) return NextResponse.json({ error: 'Configura al menos un nivel' }, { status: 400 })
  const saleDiscount = Math.min(90, Math.max(0, Number(body.saleDiscount ?? 25)))
  await Promise.all([saveWholesaleTiers(tiers), saveSaleDiscount(saleDiscount)])
  await auditLog({ action: 'update', entity: 'wholesale', admin: admin.name, details: JSON.stringify(tiers) })
  return NextResponse.json({ tiers, saleDiscount })
}
