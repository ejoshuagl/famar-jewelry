import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, setVisible, setFeatured, setIsNew, setIsOnSale } = body
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No products selected' }, { status: 400 })
    }

    const products = await db.product.findMany({ where: { id: { in: ids } } })

    for (const product of products) {
      const data: Record<string, unknown> = {}
      if (setVisible !== undefined) {
        data.visible = !!setVisible
      }
      if (setFeatured !== undefined) {
        data.isFeatured = !!setFeatured
      }
      if (setIsNew !== undefined) {
        data.isNew = !!setIsNew
      }
      if (setIsOnSale !== undefined) {
        data.isOnSale = !!setIsOnSale
      }
      if (Object.keys(data).length > 0) {
        await db.product.update({ where: { id: product.id }, data })
      }
    }

    return NextResponse.json({ updated: products.length })
  } catch (error) {
    console.error('POST /api/products/bulk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
