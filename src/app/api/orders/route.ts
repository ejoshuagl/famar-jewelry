import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { calculateDiscount, getSaleDiscount } from '@/lib/commerce'
import { ensureProductRelations } from '@/lib/relations'
import { ensureCampaignTable } from '@/lib/campaigns'
import { salePrice } from '@/lib/pricing'

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
      include: {
        campaign: { select: { id: true, title: true } },
        couponRedemption: {
          select: {
            discount: true,
            coupon: { select: { code: true, description: true } },
          },
        },
        items: { include: { product: { select: { mainImage: true, stock: true } } } },
      },
    })

    return NextResponse.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureProductRelations()
    const body = await request.json()
    const { customerName, customerCity, customerPhone, customerAddress, customerLocation, observations, items, couponCode, campaignId } = body

    if (!customerName || !customerCity || !customerPhone || !items || !items.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!/^09\d{8}$/.test(String(customerPhone).trim())) {
      return NextResponse.json({ error: 'Número celular ecuatoriano inválido' }, { status: 400 })
    }
    if (!String(customerAddress || '').trim() && !String(customerLocation || '').startsWith('https://maps.google.com/')) {
      return NextResponse.json({ error: 'La dirección o ubicación actual es obligatoria' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length > 100) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
    const requestedItems = items as Array<{ productId: string; quantity: number; variantId?: string }>
    if (requestedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ error: 'Cantidades inválidas' }, { status: 400 })
    }
    const productIds = [...new Set(requestedItems.map((item) => item.productId))]
    const [products, saleDiscount] = await Promise.all([
      db.product.findMany({ where: { id: { in: productIds }, visible: true }, select: { id: true, name: true, code: true, price: true, stock: true, status: true, variants: true, isOnSale: true } }),
      getSaleDiscount(),
    ])
    const productMap = new Map(products.map((product) => [product.id, product]))
    const validatedItems = requestedItems.map((item) => {
      const product = productMap.get(item.productId)
      if (!product || product.status !== 'available') throw new Error('PRODUCT_UNAVAILABLE')
      let available = product.stock; let variantName: string | null = null
      if (item.variantId) {
        let variants: Array<{ id: string; name: string; stock: number }> = []
        try { variants = product.variants ? JSON.parse(product.variants) : [] } catch { variants = [] }
        const variant = variants.find((entry) => entry.id === item.variantId)
        if (!variant) throw new Error('VARIANT_INVALID')
        available = Number(variant.stock); variantName = variant.name
      }
      if (item.quantity > available) throw new Error('INSUFFICIENT_STOCK')
      return { productId: product.id, quantity: item.quantity, price: salePrice(product.price, product.isOnSale, saleDiscount), isOnSale: product.isOnSale, name: product.name, code: product.code, variantId: item.variantId || null, variantName }
    })
    const eligibleSubtotal = validatedItems.filter((item) => !item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const saleSubtotal = validatedItems.filter((item) => item.isOnSale).reduce((sum, item) => sum + item.price * item.quantity, 0)
    const pricing = await calculateDiscount(eligibleSubtotal, String(couponCode || ''), saleSubtotal)
    let attributedCampaignId: string | null = null
    if (typeof campaignId === 'string' && campaignId) {
      await ensureCampaignTable()
      const campaign = await db.campaign.findFirst({
        where: {
          id: campaignId,
          active: true,
          startAt: { lte: new Date() },
          endAt: { gte: new Date() },
          products: { some: { productId: { in: productIds } } },
        },
        select: { id: true },
      })
      attributedCampaignId = campaign?.id || null
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
    const order = await db.$transaction(async (tx) => {
      if (pricing.coupon) {
        const previousClaim = await tx.couponRedemption.findFirst({
          where: { couponId: pricing.couponId || '', customerPhone: String(customerPhone).trim() },
          select: { id: true },
        })
        if (previousClaim) throw new Error('COUPON_ALREADY_USED')
        const claimed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `UPDATE "DiscountCoupon" SET "usageCount" = "usageCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE UPPER("code") = UPPER($1) AND "active" = true
           AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit") RETURNING "id"`, pricing.coupon,
        )
        if (!claimed.length) throw new Error('COUPON_EXHAUSTED')
      }
      const createdOrder = await tx.order.create({ data: {
        orderNumber,
        customerName,
        customerCity,
        customerPhone,
        customerAddress: String(customerAddress || '').trim() || null,
        customerLocation: String(customerLocation || '').trim() || null,
        campaignId: attributedCampaignId,
        observations: `${String(observations || '').trim()}${pricing.percent ? `${observations ? '\n' : ''}[${pricing.source}: ${pricing.percent}%]` : ''}` || null,
        total: pricing.total,
        status: 'pending',
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
      }, include: { items: { include: { product: { select: { mainImage: true, stock: true } } } } } })
      if (pricing.coupon && pricing.couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId: pricing.couponId,
            orderId: createdOrder.id,
            customerPhone: String(customerPhone).trim(),
            discount: pricing.percent,
          },
        })
      }
      return createdOrder
    })

    return NextResponse.json({ ...order, subtotal: pricing.subtotal, discountPercent: pricing.percent, discountAmount: pricing.amount, discountSource: pricing.source }, { status: 201 })
  } catch (error) {
    console.error('POST /api/orders error:', error)
    if (error instanceof Error && ['PRODUCT_UNAVAILABLE', 'VARIANT_INVALID', 'INSUFFICIENT_STOCK'].includes(error.message)) {
      return NextResponse.json({ error: 'Uno de los productos o variantes ya no está disponible en la cantidad solicitada' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'COUPON_EXHAUSTED') return NextResponse.json({ error: 'Este cupón acaba de alcanzar su límite de reclamaciones' }, { status: 409 })
    if (error instanceof Error && error.message === 'COUPON_ALREADY_USED') return NextResponse.json({ error: 'Este número ya reclamó el cupón' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
