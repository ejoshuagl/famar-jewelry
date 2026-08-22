import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

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

    // Sales series, selectable period: 7 | 30 | 90 days or all (grouped by month)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7'
    const orders = await db.order.findMany({
      where: { status: 'confirmed' },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    })

    let start = new Date()
    start.setHours(0, 0, 0, 0)
    if (period === '7' || period === '30' || period === '90') {
      start.setDate(start.getDate() - (parseInt(period) - 1))
    } else if (orders.length > 0) {
      start = new Date(orders[0].createdAt)
      start.setHours(0, 0, 0, 0)
    } else {
      start.setDate(start.getDate() - 6)
    }

    const inRange = orders.filter((o) => o.createdAt >= start)
    const salesLast7Days: { day: string; total: number; count: number }[] = []

    if (period === '7' || period === '30') {
      const days = period === '7' ? 7 : 30
      for (let i = 0; i < days; i++) {
        const day = new Date(start)
        day.setDate(day.getDate() + i)
        const next = new Date(day)
        next.setDate(next.getDate() + 1)
        const dayOrders = inRange.filter((o) => o.createdAt >= day && o.createdAt < next)
        salesLast7Days.push({
          day: day.toLocaleDateString('es-EC', period === '7' ? { weekday: 'short' } : { day: '2-digit', month: 'short' }),
          total: dayOrders.reduce((s, o) => s + o.total, 0),
          count: dayOrders.length,
        })
      }
    } else if (period === '90') {
      // 12 weeks
      const weekStart = new Date(start)
      for (let i = 0; i < 13; i++) {
        const from = new Date(weekStart)
        from.setDate(weekStart.getDate() + i * 7)
        const to = new Date(from)
        to.setDate(from.getDate() + 7)
        const weekOrders = inRange.filter((o) => o.createdAt >= from && o.createdAt < to)
        salesLast7Days.push({
          day: from.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }),
          total: weekOrders.reduce((s, o) => s + o.total, 0),
          count: weekOrders.length,
        })
      }
    } else {
      // All: group by month from first order
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      const now = new Date()
      const months = (now.getFullYear() - cursor.getFullYear()) * 12 + now.getMonth() - cursor.getMonth() + 1
      for (let i = 0; i < Math.min(months, 24); i++) {
        const from = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1)
        const to = new Date(cursor.getFullYear(), cursor.getMonth() + i + 1, 1)
        const monthOrders = inRange.filter((o) => o.createdAt >= from && o.createdAt < to)
        salesLast7Days.push({
          day: from.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' }),
          total: monthOrders.reduce((s, o) => s + o.total, 0),
          count: monthOrders.length,
        })
      }
    }

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

    // Sales by category, from real order items (non-cancelled orders)
    const soldItems = await db.orderItem.findMany({
      where: { order: { status: 'confirmed' } },
      select: { quantity: true, product: { select: { category: { select: { name: true } } } } },
    })
    const byCat = new Map<string, number>()
    for (const item of soldItems) {
      const name = item.product?.category?.name || 'Sin categoría'
      byCat.set(name, (byCat.get(name) || 0) + item.quantity)
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
