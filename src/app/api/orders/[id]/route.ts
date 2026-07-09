import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT - Update order status OR modify order items
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
    const { status, items, observations, customerName, customerCity, customerPhone, total } = body

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // --- Status change only (confirm/cancel) ---
    if (status && !items && total === undefined) {
      if (status !== 'confirmed' && status !== 'cancelled') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      if (order.status !== 'pending') {
        return NextResponse.json({ error: 'Solo se pueden modificar pedidos pendientes' }, { status: 400 })
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
    }

    // --- Modify order items and/or details ---
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Solo se pueden modificar pedidos pendientes' }, { status: 400 })
    }

    // Calculate new total from items
    const newTotal = total !== undefined
      ? parseFloat(total)
      : (items || []).reduce((sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price, 0)

    // Delete existing items
    await db.orderItem.deleteMany({ where: { orderId: id } })

    // Create updated items
    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        total: newTotal,
        ...(observations !== undefined ? { observations: observations || null } : {}),
        ...(customerName ? { customerName } : {}),
        ...(customerCity ? { customerCity } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        items: {
          create: (items || []).map((item: { productId: string; quantity: number; price: number; name: string; code: string }) => ({
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

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Permanently delete an order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If confirmed order, restore stock
    if (order.status === 'confirmed') {
      const orderItems = await db.orderItem.findMany({ where: { orderId: id } })
      for (const item of orderItems) {
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (product) {
          const newStock = product.stock + item.quantity
          await db.product.update({
            where: { id: item.productId },
            data: {
              stock: newStock,
              status: newStock > 0 ? 'available' : product.status,
            },
          })
        }
      }
    }

    // Delete order (cascade will delete order items)
    await db.order.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}