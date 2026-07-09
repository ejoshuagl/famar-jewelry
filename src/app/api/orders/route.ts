import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOrderNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      include: { items: true },
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

    const orderNumber = generateOrderNumber()
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
      include: { items: true },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}