import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

const ECUADOR_TIME_ZONE = 'America/Guayaquil'
const ECUADOR_UTC_OFFSET_HOURS = 5
const DAY_MS = 86_400_000

function getEcuadorDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() - ECUADOR_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  }
}

function ecuadorMidnightUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, ECUADOR_UTC_OFFSET_HOURS))
}

function formatEcuadorDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString('es-EC', { ...options, timeZone: ECUADOR_TIME_ZONE })
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    // Sales series, selectable period: 7 | 30 | 90 days or all (grouped by month)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7'
    const today = getEcuadorDateParts()
    let start = ecuadorMidnightUtc(today.year, today.month, today.day)
    if (period === '7' || period === '30' || period === '90') {
      start = new Date(start.getTime() - (parseInt(period) - 1) * DAY_MS)
    } else {
      start = ecuadorMidnightUtc(today.year, today.month - 23, 1)
    }

    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      revenueResult,
      orders,
      oneUnitCount,
      twoUnitsCount,
      threePlusCount,
      outOfStockCount,
      hiddenCount,
      availableStock,
      soldItems,
      recentOrders,
    ] = await Promise.all([
      db.product.count(),
      db.order.count(),
      db.order.count({ where: { status: 'pending' } }),
      db.order.count({ where: { status: 'confirmed' } }),
      db.order.aggregate({ where: { status: 'confirmed' }, _sum: { total: true } }),
      db.order.findMany({
        where: { status: 'confirmed', createdAt: { gte: start } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.product.count({ where: { visible: true, stock: 1 } }),
      db.product.count({ where: { visible: true, stock: 2 } }),
      db.product.count({ where: { visible: true, stock: { gte: 3 } } }),
      db.product.count({ where: { visible: true, stock: { lte: 0 } } }),
      db.product.count({ where: { visible: false } }),
      db.product.aggregate({ where: { visible: true, stock: { gt: 0 } }, _sum: { stock: true } }),
      db.orderItem.findMany({
        where: { order: { status: 'confirmed' } },
        select: { quantity: true, product: { select: { category: { select: { name: true } } } } },
      }),
      db.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
      }),
    ])
    const totalRevenue = revenueResult._sum.total || 0
    const avgOrderValue = confirmedOrders > 0 ? totalRevenue / confirmedOrders : 0
    const availableUnits = availableStock._sum.stock || 0
    const inRange = orders
    const salesLast7Days: { day: string; total: number; count: number }[] = []

    if (period === '7' || period === '30') {
      const days = period === '7' ? 7 : 30
      for (let i = 0; i < days; i++) {
        const day = new Date(start.getTime() + i * DAY_MS)
        const next = new Date(day.getTime() + DAY_MS)
        const dayOrders = inRange.filter((o) => o.createdAt >= day && o.createdAt < next)
        salesLast7Days.push({
          day: formatEcuadorDate(day, period === '7' ? { weekday: 'short' } : { day: '2-digit', month: 'short' }),
          total: dayOrders.reduce((s, o) => s + o.total, 0),
          count: dayOrders.length,
        })
      }
    } else if (period === '90') {
      // 12 weeks
      const weekStart = new Date(start)
      for (let i = 0; i < 13; i++) {
        const from = new Date(weekStart.getTime() + i * 7 * DAY_MS)
        const to = new Date(from.getTime() + 7 * DAY_MS)
        const weekOrders = inRange.filter((o) => o.createdAt >= from && o.createdAt < to)
        salesLast7Days.push({
          day: formatEcuadorDate(from, { day: '2-digit', month: 'short' }),
          total: weekOrders.reduce((s, o) => s + o.total, 0),
          count: weekOrders.length,
        })
      }
    } else {
      // All: group by month from first order
      const cursorParts = getEcuadorDateParts(start)
      const months = (today.year - cursorParts.year) * 12 + today.month - cursorParts.month + 1
      for (let i = 0; i < Math.min(months, 24); i++) {
        const from = ecuadorMidnightUtc(cursorParts.year, cursorParts.month + i, 1)
        const to = ecuadorMidnightUtc(cursorParts.year, cursorParts.month + i + 1, 1)
        const monthOrders = inRange.filter((o) => o.createdAt >= from && o.createdAt < to)
        salesLast7Days.push({
          day: formatEcuadorDate(from, { month: 'short', year: '2-digit' }),
          total: monthOrders.reduce((s, o) => s + o.total, 0),
          count: monthOrders.length,
        })
      }
    }

    // Sales by category, from real order items (non-cancelled orders)
    const byCat = new Map<string, number>()
    for (const item of soldItems) {
      const name = item.product?.category?.name || 'Sin categoría'
      byCat.set(name, (byCat.get(name) || 0) + item.quantity)
    }
    const salesByCategory = Array.from(byCat.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6)

    return NextResponse.json({
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      totalRevenue,
      avgOrderValue,
      salesLast7Days,
      availability: { availableUnits, oneUnitCount, twoUnitsCount, threePlusCount, outOfStockCount, hiddenCount },
      salesByCategory,
      recentOrders,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
