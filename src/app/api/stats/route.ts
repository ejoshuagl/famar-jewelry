import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const totalProducts = await db.product.count()
    const totalOrders = await db.order.count()
    const pendingOrders = await db.order.count({ where: { status: 'pending' } })
    const confirmedOrders = await db.order.count({ where: { status: 'confirmed' } })

    const revenueResult = await db.order.aggregate({
      where: { status: 'confirmed' },
      _sum: { total: true },
    })
    const totalRevenue = revenueResult._sum.total || 0
    const avgOrderValue = confirmedOrders > 0 ? totalRevenue / confirmedOrders : 0

    // Sales of the last 7 days (confirmed orders)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    weekAgo.setHours(0, 0, 0, 0)
    const weekOrders = await db.order.findMany({
      where: { createdAt: { gte: weekAgo }, status: { not: 'cancelled' } },
      select: { createdAt: true, total: true },
    })
    const salesLast7Days = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(weekAgo)
      day.setDate(day.getDate() + i)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const dayOrders = weekOrders.filter((o) => o.createdAt >= day && o.createdAt < next)
      return {
        day: day.toLocaleDateString('es-EC', { weekday: 'short' }),
        total: dayOrders.reduce((s, o) => s + o.total, 0),
        count: dayOrders.length,
      }
    })

    // Inventory availability
    const availableCount = await db.product.count({
      where: { visible: true, status: 'available', stock: { gt: 5 } },
    })
    const lowStockCount = await db.product.count({
      where: { visible: true, status: 'available', stock: { lte: 5, gt: 0 } },
    })
    const outOfStockCount = await db.product.count({
      where: { visible: true, status: 'out_of_stock' },
    })
    const hiddenCount = await db.product.count({ where: { visible: false } })

    // Sales by category (units sold)
    const products = await db.product.findMany({
      select: { salesCount: true, category: { select: { name: true } } },
    })
    const byCat = new Map<string, number>()
    for (const p of products) {
      const name = p.category?.name || 'Sin categoría'
      byCat.set(name, (byCat.get(name) || 0) + p.salesCount)
    }
    const salesByCategory = Array.from(byCat.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6)

    const recentOrders = await db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { items: true },
    })

    return NextResponse.json({
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      totalRevenue,
      avgOrderValue,
      salesLast7Days,
      availability: { availableCount, lowStockCount, outOfStockCount, hiddenCount },
      salesByCategory,
      recentOrders,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
