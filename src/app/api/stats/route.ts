import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { ensureStoreEventsTable } from '@/lib/store-events'

const ECUADOR_TIME_ZONE = 'America/Guayaquil'
const ECUADOR_UTC_OFFSET_HOURS = 5
const DAY_MS = 86_400_000

type StatsSummary = {
  totalProducts: number
  totalOrders: number
  pendingOrders: number
  confirmedOrders: number
  totalRevenue: number
  oneUnitCount: number
  twoUnitsCount: number
  threePlusCount: number
  outOfStockCount: number
  hiddenCount: number
  availableUnits: number
}

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

function parseEcuadorDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = ecuadorMidnightUtc(year, month - 1, day)
  const parts = getEcuadorDateParts(date)
  return parts.year === year && parts.month === month - 1 && parts.day === day ? date : null
}

function funnelDateRange(searchParams: URLSearchParams, today: ReturnType<typeof getEcuadorDateParts>) {
  const period = searchParams.get('funnelPeriod') || 'today'
  const tomorrow = ecuadorMidnightUtc(today.year, today.month, today.day + 1)
  if (period === 'all') return { period, start: new Date(0), end: tomorrow }
  if (period === 'week') {
    const current = ecuadorMidnightUtc(today.year, today.month, today.day)
    const weekday = current.getUTCDay() || 7
    return { period, start: new Date(current.getTime() - (weekday - 1) * DAY_MS), end: tomorrow }
  }
  if (period === 'month') {
    return { period, start: ecuadorMidnightUtc(today.year, today.month, 1), end: tomorrow }
  }
  if (period === 'custom') {
    const from = parseEcuadorDate(searchParams.get('funnelFrom'))
    const to = parseEcuadorDate(searchParams.get('funnelTo'))
    if (from && to && from <= to) {
      return { period, start: from, end: new Date(to.getTime() + DAY_MS) }
    }
  }
  return {
    period: 'today',
    start: ecuadorMidnightUtc(today.year, today.month, today.day),
    end: tomorrow,
  }
}

function formatEcuadorDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString('es-EC', { ...options, timeZone: ECUADOR_TIME_ZONE })
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(request, 'dashboard')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    // Sales series, selectable period: 7 | 30 | 90 days or all (grouped by month)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7'
    const today = getEcuadorDateParts()
    const funnelRange = funnelDateRange(searchParams, today)
    let start = ecuadorMidnightUtc(today.year, today.month, today.day)
    if (period === '7' || period === '30' || period === '90') {
      start = new Date(start.getTime() - (parseInt(period) - 1) * DAY_MS)
    } else {
      start = ecuadorMidnightUtc(today.year, today.month - 23, 1)
    }

    const startedAt = performance.now()
    await ensureStoreEventsTable()
    const resetSetting = await db.commerceSetting.findUnique({ where: { key: 'funnel_reset_at' } })
    const parsedResetAt = resetSetting?.value ? new Date(resetSetting.value) : new Date(0)
    const resetAt = Number.isNaN(parsedResetAt.getTime()) ? new Date(0) : parsedResetAt
    const funnelStart = funnelRange.start > resetAt ? funnelRange.start : resetAt
    const [summaryRows, orders, salesByCategory, recentOrders, funnelRows, funnelDailyRows, cartStateRows] = await Promise.all([
      db.$queryRaw<StatsSummary[]>`
        SELECT
          (SELECT COUNT(*)::int FROM "Product") AS "totalProducts",
          (SELECT COUNT(*)::int FROM "Order") AS "totalOrders",
          (SELECT COUNT(*)::int FROM "Order" WHERE status = 'pending') AS "pendingOrders",
          (SELECT COUNT(*)::int FROM "Order" WHERE status = 'confirmed') AS "confirmedOrders",
          COALESCE((SELECT SUM(total) FROM "Order" WHERE status = 'confirmed'), 0)::float8 AS "totalRevenue",
          (SELECT COUNT(*)::int FROM "Product" WHERE visible = true AND stock = 1) AS "oneUnitCount",
          (SELECT COUNT(*)::int FROM "Product" WHERE visible = true AND stock = 2) AS "twoUnitsCount",
          (SELECT COUNT(*)::int FROM "Product" WHERE visible = true AND stock >= 3) AS "threePlusCount",
          (SELECT COUNT(*)::int FROM "Product" WHERE visible = true AND stock <= 0) AS "outOfStockCount",
          (SELECT COUNT(*)::int FROM "Product" WHERE visible = false) AS "hiddenCount",
          COALESCE((SELECT SUM(stock) FROM "Product" WHERE visible = true AND stock > 0), 0)::int AS "availableUnits"
      `,
      db.order.findMany({
        where: { status: 'confirmed', createdAt: { gte: start } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.$queryRaw<Array<{ name: string; sales: number }>>`
        SELECT COALESCE(c.name, 'Sin categoría') AS name, SUM(oi.quantity)::int AS sales
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        INNER JOIN "Product" p ON p.id = oi."productId"
        LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE o.status = 'confirmed'
        GROUP BY COALESCE(c.name, 'Sin categoría')
        ORDER BY sales DESC
        LIMIT 6
      `,
      db.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
      }),
      db.$queryRaw<Array<{ type: string; total: number }>>`
        SELECT type, COUNT(*)::int AS total FROM "StoreEvent"
        WHERE "createdAt" >= ${funnelStart} AND "createdAt" < ${funnelRange.end}
          AND type IN ('product_view', 'add_to_cart', 'checkout_started', 'order_created')
        GROUP BY type
      `,
      db.$queryRaw<Array<{ date: string; product_view: number; add_to_cart: number; checkout_started: number; order_created: number }>>`
        SELECT TO_CHAR(("createdAt" - INTERVAL '5 hours')::date, 'DD/MM/YYYY') AS date,
          COUNT(*) FILTER (WHERE type = 'product_view')::int AS product_view,
          COUNT(*) FILTER (WHERE type = 'add_to_cart')::int AS add_to_cart,
          COUNT(*) FILTER (WHERE type = 'checkout_started')::int AS checkout_started,
          COUNT(*) FILTER (WHERE type = 'order_created')::int AS order_created
        FROM "StoreEvent"
        WHERE "createdAt" >= ${funnelStart} AND "createdAt" < ${funnelRange.end}
          AND type IN ('product_view', 'add_to_cart', 'checkout_started', 'order_created')
        GROUP BY ("createdAt" - INTERVAL '5 hours')::date
        ORDER BY ("createdAt" - INTERVAL '5 hours')::date DESC
      `,
      db.$queryRaw<Array<{ activeCarts: number; activeItems: number }>>`
        SELECT COUNT(*) FILTER (WHERE "itemCount" > 0)::int AS "activeCarts",
          COALESCE(SUM("itemCount") FILTER (WHERE "itemCount" > 0), 0)::int AS "activeItems"
        FROM "CartState"
        WHERE "updatedAt" >= GREATEST(${resetAt}, CURRENT_TIMESTAMP - INTERVAL '30 days')
      `,
    ])
    const summary = summaryRows[0] || {
      totalProducts: 0, totalOrders: 0, pendingOrders: 0, confirmedOrders: 0, totalRevenue: 0,
      oneUnitCount: 0, twoUnitsCount: 0, threePlusCount: 0, outOfStockCount: 0, hiddenCount: 0, availableUnits: 0,
    }
    const avgOrderValue = summary.confirmedOrders > 0 ? summary.totalRevenue / summary.confirmedOrders : 0
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

    const result = {
      totalProducts: summary.totalProducts,
      totalOrders: summary.totalOrders,
      pendingOrders: summary.pendingOrders,
      confirmedOrders: summary.confirmedOrders,
      totalRevenue: summary.totalRevenue,
      avgOrderValue,
      salesLast7Days,
      availability: {
        availableUnits: summary.availableUnits,
        oneUnitCount: summary.oneUnitCount,
        twoUnitsCount: summary.twoUnitsCount,
        threePlusCount: summary.threePlusCount,
        outOfStockCount: summary.outOfStockCount,
        hiddenCount: summary.hiddenCount,
      },
      salesByCategory,
      recentOrders,
      funnel: Object.fromEntries(['product_view', 'add_to_cart', 'checkout_started', 'order_created'].map((type) => [type, funnelRows.find((row) => row.type === type)?.total || 0])),
      funnelPeriod: funnelRange.period,
      funnelRange: {
        from: funnelRange.period === 'all' ? 'Inicio actual' : formatEcuadorDate(funnelStart, { year: 'numeric', month: '2-digit', day: '2-digit' }),
        to: formatEcuadorDate(new Date(funnelRange.end.getTime() - 1), { year: 'numeric', month: '2-digit', day: '2-digit' }),
      },
      funnelDaily: funnelDailyRows.map((row) => ({
        date: row.date,
        product_view: row.product_view,
        add_to_cart: row.add_to_cart,
        checkout_started: row.checkout_started,
        order_created: row.order_created,
      })),
      activeCarts: cartStateRows[0] || { activeCarts: 0, activeItems: 0 },
    }
    console.info(JSON.stringify({ event: 'stats.loaded', period, durationMs: Math.round(performance.now() - startedAt) }))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
