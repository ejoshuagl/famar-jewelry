import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatPrice } from '@/lib/utils'
import { requireAdmin, auditLog, hasPermission } from '@/lib/admin-auth'
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
    const rawItems = items as Array<{ productId: string; quantity: number; variantId?: string }>
    if (rawItems.some((item) => typeof item?.productId !== 'string' || !item.productId || (item.variantId != null && typeof item.variantId !== 'string') || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000)) {
      return NextResponse.json({ error: 'Cantidades inválidas' }, { status: 400 })
    }
    const grouped = new Map<string, typeof rawItems[number]>()
    for (const item of rawItems) {
      const key = JSON.stringify([item.productId, item.variantId || ''])
      grouped.set(key, { ...item, quantity: item.quantity + (grouped.get(key)?.quantity || 0) })
    }
    const requestedItems = [...grouped.values()]
    const phone = customerPhone === undefined ? order.customerPhone : customerPhone
    if (typeof phone !== 'string' || !/^09\d{8}$/.test(phone.trim())
      || [customerName, customerCity].some((value) => value !== undefined && (typeof value !== 'string' || !value.trim()))
      || (customerName?.length || 0) > 100 || (customerCity?.length || 0) > 80
      || (observations !== undefined && (typeof observations !== 'string' || observations.length > 1000))
      || (body.couponCode !== undefined && (typeof body.couponCode !== 'string' || body.couponCode.length > 50))
      || (body.applyWholesaleDiscount !== undefined && typeof body.applyWholesaleDiscount !== 'boolean')) {
      return NextResponse.json({ error: 'Revisa los datos del cliente, teléfono y descuento' }, { status: 400 })
    }
    const oldCoupon = order.couponRedemption?.coupon.code || ''
    const couponCode = body.couponCode === undefined ? oldCoupon : body.couponCode.trim().toUpperCase()
    const previousWholesale = !/\[Pedido manual · mayorista no habilitado/.test(order.observations || '')
    const includeWholesale = body.applyWholesaleDiscount ?? previousWholesale
    if ((couponCode.toUpperCase() !== oldCoupon.toUpperCase() && !hasPermission(admin.permissions, 'orders:coupon'))
      || (includeWholesale !== previousWholesale && !hasPermission(admin.permissions, 'orders:wholesale'))) {
      return NextResponse.json({ error: 'No tienes permiso para modificar este descuento' }, { status: 403 })
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
      const variants = parseVariants(product.variants)
      if (variants.length && !item.variantId) throw new Error('VARIANT_INVALID')
      if (item.variantId) {
        const variant = variants.find((entry) => entry.id === item.variantId)
        if (!variant) throw new Error('VARIANT_INVALID')
        available = variant.stock
        variantName = variant.name
      }
      if (item.quantity > available || item.quantity > 100000) throw new Error('INSUFFICIENT_STOCK')
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
    for (const product of products) {
      const quantity = validatedItems.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)
      if (quantity > product.stock) throw new Error('INSUFFICIENT_STOCK')
    }
    const eligibleSubtotal = validatedItems.filter((item) => !item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const saleSubtotal = validatedItems.filter((item) => item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const pricing = await calculateDiscount(eligibleSubtotal, couponCode, saleSubtotal, includeWholesale)
    if (couponCode && !pricing.validCoupon) {
      return NextResponse.json({ error: 'El cupón no es válido, está vencido, agotado o no cumple el mínimo con productos sin oferta. Retíralo o corrige el pedido.' }, { status: 400 })
    }
    const cleanObs = String(observations ?? order.observations ?? '')
      .replace(/\[(?:Descuento mayorista:|Cupón |Pedido manual · mayorista )[^\]]*\]/g, '').trim()
    const updatedObs = [cleanObs, pricing.percent ? `[${pricing.source}: ${pricing.percent}%]` : '',
      `[Pedido manual · mayorista ${includeWholesale ? 'habilitado' : 'no habilitado'}${couponCode ? ` · cupón ${couponCode}` : ''}]`].filter(Boolean).join('\n')

    const updatedOrder = await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE`, id)
      const currentOrder = await tx.order.findUnique({ where: { id }, select: { status: true } })
      if (!currentOrder || currentOrder.status !== 'pending') throw new Error('ORDER_ALREADY_PROCESSED')
      if (pricing.couponId) {
        const duplicate = await tx.couponRedemption.findFirst({ where: {
          couponId: pricing.couponId, customerPhone: phone.trim(), orderId: { not: id },
        } })
        if (duplicate) throw new Error('COUPON_ALREADY_USED')
        const coupon = await tx.discountCoupon.findUnique({ where: { id: pricing.couponId } })
        const now = new Date()
        if (!coupon?.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)
          || coupon.minPurchase > eligibleSubtotal || coupon.discount !== pricing.percent
          || (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)) throw new Error('COUPON_EXHAUSTED')
      }
      if (body.preview === true) return { ...pricing, items: validatedItems }
      await tx.couponRedemption.deleteMany({ where: { orderId: id } })
      if (pricing.couponId) await tx.couponRedemption.create({ data: {
        orderId: id, couponId: pricing.couponId, customerPhone: phone.trim(), discount: pricing.percent, claimedAt: null,
      } })
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      return tx.order.update({ where: { id }, data: {
        total: pricing.total,
        stockReserved: false,
        observations: updatedObs,
        ...(customerName ? { customerName } : {}),
        ...(customerCity ? { customerCity } : {}),
        customerPhone: phone.trim(),
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

    if (body.preview !== true) await auditLog({ action: 'update', entity: 'order', entityId: id, admin: adminName, details: `#${order.orderNumber}: productos y datos actualizados — ${pricing.source || 'sin descuento'} — ${formatPrice(pricing.total)}` })
    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error)
    if (error instanceof Error && (error.message === 'COUPON_ALREADY_USED' || ('code' in error && error.code === 'P2002'))) {
      return NextResponse.json({ error: 'Ya reclamaste este cupón. Compártelo con otra persona para que también pueda aprovecharlo.' }, { status: 409 })
    }
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

    await auditLog({ action: 'delete', entity: 'order', entityId: id, admin: adminName, details: `#${order.orderNumber}` })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
