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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ]
    }

    const total = await db.order.count({ where })
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } },
    })

    return NextResponse.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerName, customerCity, customerPhone, observations, items, total } = body

    if (!customerName || !customerCity || !customerPhone || !items || !items.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Sequential order number: FAM-000001, FAM-000002...
    const lastSeq = await db.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(NULLIF(regexp_replace("orderNumber", '\\D', '', 'g'), '')::bigint) AS max
      FROM "Order"
      WHERE "orderNumber" ~ '^FAM-\\d{1,6}$'
    `
    const totalCount = await db.order.count()
    const lastNumber = Math.max(Number(lastSeq[0]?.max || 0), totalCount)
    const orderNumber = `FAM-${String(lastNumber + 1).padStart(6, '0')}`
    const order = await db.order.create({
      data: {
        orderNumber,
        customerName,
        customerCity,
        customerPhone,
        observations: observations || null,
        total: parseFloat(total),
        status: 'pending',
        items: {
          create: items.map((item: { productId: string; quantity: number; price: number; name: string; code: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            code: item.code,
          })),
        },
      },
      include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}