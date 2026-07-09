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

    const topSelling = await db.product.findMany({
      orderBy: { salesCount: 'desc' },
      take: 5,
      include: { category: { select: { name: true } } },
    })

    const lowStock = await db.product.findMany({
      where: {
        status: 'available',
        stock: { lte: 5 },
      },
      orderBy: { stock: 'asc' },
      take: 10,
    })

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
      topSelling,
      lowStock,
      recentOrders,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}