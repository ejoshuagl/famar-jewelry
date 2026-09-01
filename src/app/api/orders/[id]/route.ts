import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatPrice } from '@/lib/utils'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { adjustOrderStock } from '@/lib/order-stock'
import { ensureOrderStockReservationColumn } from '@/lib/orders'

// PUT - Update order status OR modify order items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureOrderStockReservationColumn()
    const admin = requireAdmin(request, 'orders')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const body = await request.json()
    const { status, items, observations, customerName, customerCity, customerPhone, total, cancelReason } = body

    const order = await db.order.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } },
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

      const updatedOrder = await db.$transaction(async (tx) => {
        if (status === 'confirmed') {
          if (!order.stockReserved) await adjustOrderStock(tx, order.items, 'reserve')
          for (const item of order.items) {
            await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: item.quantity } } })
          }
        }
        return tx.order.update({
          where: { id },
          data: {
            status,
            stockReserved: status === 'confirmed',
            ...(status === 'cancelled' && cancelReason !== undefined && { cancelReason: cancelReason || null }),
          },
          include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } },
        })
      })

      await auditLog({
        action: status === 'confirmed' ? 'confirm' : 'cancel',
        entity: 'order',
        entityId: order.id,
        admin: adminName,
        details: `#${order.orderNumber} (${formatPrice(order.total)})${cancelReason ? ' — motivo: ' + cancelReason : ''}`,
      })

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

    const updatedOrder = await db.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      return tx.order.update({ where: { id }, data: {
        total: newTotal,
        stockReserved: false,
        ...(observations !== undefined ? { observations: observations || null } : {}),
        ...(customerName ? { customerName } : {}),
        ...(customerCity ? { customerCity } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        items: {
          create: (items || []).map((item: { productId: string; quantity: number; price: number; name: string; code: string; variantId?: string; variantName?: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            code: item.code,
            variantId: item.variantId || null,
            variantName: item.variantName || null,
          })),
        },
      },
      include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } },
      })
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
    await ensureOrderStockReservationColumn()
    const admin = requireAdmin(request, 'orders')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params

    const order = await db.order.findUnique({ where: { id }, include: { items: true } })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      if (order.stockReserved) await adjustOrderStock(tx, order.items, 'restore')
      if (order.status === 'confirmed') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { salesCount: { decrement: item.quantity } },
          })
        }
      }
      await tx.order.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
