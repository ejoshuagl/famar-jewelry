import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, requireAdmin } from '@/lib/admin-auth'

function finiteMoney(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(`${value}T05:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  const optionsOnly = request.nextUrl.searchParams.get('options') === 'true'
  const admin = await requireAdmin(request, optionsOnly ? 'products' : 'investments')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (optionsOnly) {
    const investments = await db.investment.findMany({ orderBy: { purchasedAt: 'desc' }, select: { id: true, description: true, purchasedAt: true } })
    return NextResponse.json({ investments }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const [investments, revenue, revenueByInvestment] = await Promise.all([
    db.investment.findMany({
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      include: { products: { orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, stock: true, status: true, visible: true } } },
    }),
    db.order.aggregate({ where: { status: 'confirmed' }, _sum: { total: true } }),
    db.$queryRaw<Array<{ investmentId: string; revenue: number }>>`
      SELECT p."investmentId", COALESCE(SUM(oi.price * oi.quantity), 0)::float8 AS revenue
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId" AND o.status = 'confirmed'
      INNER JOIN "Product" p ON p.id = oi."productId"
      WHERE p."investmentId" IS NOT NULL
      GROUP BY p."investmentId"
    `,
  ])
  const totalMerchandise = investments.reduce((sum, item) => sum + item.merchandise, 0)
  const totalTaxes = investments.reduce((sum, item) => sum + item.taxes, 0)
  const totalInvestment = investments.reduce((sum, item) => sum + item.total, 0)
  const confirmedRevenue = revenue._sum.total || 0

  return NextResponse.json({
    investments: investments.map((investment) => {
      const recovered = revenueByInvestment.find((entry) => entry.investmentId === investment.id)?.revenue || 0
      const remainingUnits = investment.products.reduce((sum, product) => sum + Math.max(0, product.stock), 0)
      const productsInStock = investment.products.filter((product) => product.stock > 0 && product.status === 'available').length
      return {
        ...investment,
        recovered,
        balance: Math.round((recovered - investment.total) * 100) / 100,
        remainingUnits,
        productsInStock,
      }
    }),
    summary: {
      totalMerchandise,
      totalTaxes,
      totalInvestment,
      confirmedRevenue,
      balance: Math.round((confirmedRevenue - totalInvestment) * 100) / 100,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request, 'investments')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 120) : ''
  const merchandise = finiteMoney(body.merchandise)
  const taxes = finiteMoney(body.taxes)
  const purchasedAt = validDate(body.purchasedAt)
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null
  if (!description || merchandise === null || taxes === null || !purchasedAt || merchandise + taxes <= 0) {
    return NextResponse.json({ error: 'Completa correctamente la compra, los valores y la fecha' }, { status: 400 })
  }

  const total = Math.round((merchandise + taxes) * 100) / 100
  const investment = await db.investment.create({ data: { description, merchandise, taxes, total, purchasedAt, notes } })
  await auditLog({ action: 'create', entity: 'investment', entityId: investment.id, admin: admin.name, details: `${description} — $${total.toFixed(2)}` })
  return NextResponse.json(investment, { status: 201 })
}
