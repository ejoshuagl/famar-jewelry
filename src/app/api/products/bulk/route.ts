import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/admin-auth'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdmin(request, 'products')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const body = await request.json()
    const { ids, setVisible, setFeatured, setFeaturedExcluded, setIsNew, setIsOnSale } = body
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
      if (setFeaturedExcluded !== undefined) {
        data.featuredExcluded = !!setFeaturedExcluded
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

    await auditLog({
      action: 'bulk',
      entity: 'product',
      admin: adminName,
      details: `${products.length} productos: ${JSON.stringify({ setVisible, setFeatured, setFeaturedExcluded, setIsNew, setIsOnSale })}`,
    })

    return NextResponse.json({ updated: products.length })
  } catch (error) {
    console.error('POST /api/products/bulk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
