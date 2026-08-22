import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params

    const category = await db.category.findUnique({ where: { id } })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Delete order items for products in this category, then the products, then the category
    const productsInCategory = await db.product.findMany({
      where: { categoryId: id },
      select: { id: true },
    })

    if (productsInCategory.length > 0) {
      const productIds = productsInCategory.map((p) => p.id)
      await db.orderItem.deleteMany({ where: { productId: { in: productIds } } })
      await db.product.deleteMany({ where: { id: { in: productIds } } })
    }

    await db.category.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      deletedProducts: productsInCategory.length,
    })
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}