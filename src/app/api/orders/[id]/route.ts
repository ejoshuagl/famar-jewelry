import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatPrice } from '@/lib/utils'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { adjustOrderStock } from '@/lib/order-stock'
import { calculateDiscount, getSaleDiscount } from '@/lib/commerce'
import { salePrice } from '@/lib/pricing'
import { getDailySaleSelection } from '@/lib/daily-sales'
import { ensurePromotionSchema } from '@/lib/promotion-schema'
import { parseVariants } from '@/lib/product-variants'

// PUT - Update order status OR modify order items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensurePromotionSchema()
    const admin = await requireAdmin(request, 'orders')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const body = await request.json()
    const { status, items, observations, customerName, customerCity, customerPhone, total, cancelReason } = body

    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { mainImage: true, stock: true } } } },
        couponRedemption: { include: { coupon: true } },
      },
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
        await tx.$queryRawUnsafe(`SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE`, id)
        const currentOrder = await tx.order.findUnique({
          where: { id },
          include: { items: true, couponRedemption: true },
        })
        if (!currentOrder || currentOrder.status !== 'pending') throw new Error('ORDER_ALREADY_PROCESSED')
        if (status === 'confirmed') {
          if (currentOrder.couponRedemption && !currentOrder.couponRedemption.claimedAt) {
            const claimed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
              `UPDATE "DiscountCoupon" SET "usageCount" = "usageCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
               WHERE "id" = $1 AND "active" = true
               AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit") RETURNING "id"`,
              currentOrder.couponRedemption.couponId,
            )
            if (!claimed.length) throw new Error('COUPON_EXHAUSTED')
            await tx.couponRedemption.update({ where: { id: currentOrder.couponRedemption.id }, data: { claimedAt: new Date() } })
          }
          if (!currentOrder.stockReserved) await adjustOrderStock(tx, currentOrder.items, 'reserve')
          for (const item of currentOrder.items) {
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

    // Rebuild every commercial value from the database. The browser only sends
    // product IDs, variants and quantities; names, prices and totals are trusted
    // exclusively from the server.
    if (!Array.isArray(items) || !items.length || items.length > 100) {
      return NextResponse.json({ error: 'El pedido debe contener productos válidos' }, { status: 400 })
    }
    const requestedItems = items as Array<{ productId: string; quantity: number; variantId?: string }>
    if (requestedItems.some((item) => !item?.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000)) {
      return NextResponse.json({ error: 'Cantidades inválidas' }, { status: 400 })
    }
    const productIds = [...new Set(requestedItems.map((item) => item.productId))]
    const [products, saleDiscount, dailySale] = await Promise.all([
      db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true, price: true, stock: true, status: true, variants: true, isOnSale: true } }),
      getSaleDiscount(),
      getDailySaleSelection(),
    ])
    const productMap = new Map(products.map((product) => [product.id, product]))
    const validatedItems = requestedItems.map((item) => {
      const product = productMap.get(item.productId)
      if (!product || product.status !== 'available') throw new Error('PRODUCT_UNAVAILABLE')
      let available = product.stock
      let variantName: string | null = null
      if (item.variantId) {
        const variant = parseVariants(product.variants).find((entry) => entry.id === item.variantId)
        if (!variant) throw new Error('VARIANT_INVALID')
        available = variant.stock
        variantName = variant.name
      }
      if (item.quantity > available) throw new Error('INSUFFICIENT_STOCK')
      return {
        productId: product.id,
        quantity: item.quantity,
        price: salePrice(product.price, product.isOnSale || dailySale.ids.has(product.id), saleDiscount),
        name: product.name,
        code: product.code,
        variantId: item.variantId || null,
        variantName,
        isOnSale: product.isOnSale || dailySale.ids.has(product.id),
      }
    })
    const eligibleSubtotal = validatedItems.filter((item) => !item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const saleSubtotal = validatedItems.filter((item) => item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const basePricing = await calculateDiscount(eligibleSubtotal, undefined, saleSubtotal)
    const appliedPercent = Math.max(basePricing.percent, order.couponRedemption?.discount || 0)
    const newTotal = Math.round((Math.max(0, eligibleSubtotal - eligibleSubtotal * appliedPercent / 100) + saleSubtotal) * 100) / 100

    const updatedOrder = await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE`, id)
      const currentOrder = await tx.order.findUnique({ where: { id }, select: { status: true } })
      if (!currentOrder || currentOrder.status !== 'pending') throw new Error('ORDER_ALREADY_PROCESSED')
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      return tx.order.update({ where: { id }, data: {
        total: newTotal,
        stockReserved: false,
        ...(observations !== undefined ? { observations: observations || null } : {}),
        ...(customerName ? { customerName } : {}),
        ...(customerCity ? { customerCity } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        items: {
          create: validatedItems.map((item) => ({
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
      include: {
        items: { include: { product: { select: { mainImage: true, stock: true } } } },
        couponRedemption: { include: { coupon: true } },
      },
      })
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error)
    if (error instanceof Error && ['PRODUCT_UNAVAILABLE', 'VARIANT_INVALID', 'INSUFFICIENT_STOCK'].includes(error.message)) {
      return NextResponse.json({ error: 'Uno de los productos o variantes ya no está disponible en la cantidad solicitada' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'COUPON_EXHAUSTED') {
      return NextResponse.json({ error: 'Este cupón alcanzó su límite antes de confirmar el pedido' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'ORDER_ALREADY_PROCESSED') {
      return NextResponse.json({ error: 'Este pedido ya fue procesado por otro administrador' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Permanently delete an order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request, 'orders')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params

    const order = await db.order.findUnique({ where: { id }, include: { items: true, couponRedemption: true } })

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
        if (order.couponRedemption?.claimedAt) {
          await tx.$executeRaw`
            UPDATE "DiscountCoupon"
            SET "usageCount" = GREATEST(0, "usageCount" - 1), "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${order.couponRedemption.couponId}
          `
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
