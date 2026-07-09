import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (status !== 'confirmed' && status !== 'cancelled') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Order is not pending' }, { status: 400 })
    }

    const updatedOrder = await db.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    })

    if (status === 'confirmed') {
      for (const item of order.items) {
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (product) {
          const newStock = product.stock - item.quantity
          await db.product.update({
            where: { id: item.productId },
            data: {
              stock: Math.max(0, newStock),
              status: newStock <= 0 ? 'out_of_stock' : product.status,
            },
          })
        }
      }
    }

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}