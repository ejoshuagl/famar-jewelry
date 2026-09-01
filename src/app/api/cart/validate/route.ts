import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseVariants } from '@/lib/product-variants'

interface RequestedItem {
  productId: string
  variantId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestedItems = Array.isArray(body.items) ? body.items as RequestedItem[] : []
    if (!requestedItems.length || requestedItems.length > 100) {
      return NextResponse.json({ items: [] })
    }

    const productIds = [...new Set(requestedItems.map((item) => String(item.productId || '')).filter(Boolean))]
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        stock: true,
        status: true,
        visible: true,
        isOnSale: true,
        mainImage: true,
        variants: true,
      },
    })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const items = requestedItems.map((requested) => {
      const product = productMap.get(requested.productId)
      if (!product) {
        return { productId: requested.productId, variantId: requested.variantId || null, available: false }
      }

      const variants = parseVariants(product.variants)
      const variant = requested.variantId
        ? variants.find((entry) => entry.id === requested.variantId)
        : null
      const maxStock = requested.variantId ? (variant?.stock || 0) : product.stock
      return {
        productId: product.id,
        variantId: requested.variantId || null,
        available: product.visible && product.status === 'available' && maxStock > 0 && (!requested.variantId || Boolean(variant)),
        code: product.code,
        name: product.name,
        price: product.price,
        isOnSale: product.isOnSale,
        mainImage: variant?.image || product.mainImage,
        maxStock,
        variantName: variant?.name || null,
      }
    })

    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('POST /api/cart/validate error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el carrito' }, { status: 500 })
  }
}
