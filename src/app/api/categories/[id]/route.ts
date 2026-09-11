import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, auditLog, hasPermission } from '@/lib/admin-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request, 'categories')
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
      if (!hasPermission(admin.permissions, 'products:delete') || !hasPermission(admin.permissions, 'orders:delete')) return NextResponse.json({ error: 'Eliminar una categoría con productos requiere también permisos de eliminación de productos y pedidos' }, { status: 403 })
      const productIds = productsInCategory.map((p) => p.id)
      await db.orderItem.deleteMany({ where: { productId: { in: productIds } } })
      await db.product.deleteMany({ where: { id: { in: productIds } } })
    }

    await db.category.delete({ where: { id } })
    await auditLog({ action: 'delete', entity: 'category', entityId: id, admin: adminName, details: `${category.name}: ${productsInCategory.length} productos` })

    return NextResponse.json({
      success: true,
      deletedProducts: productsInCategory.length,
    })
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
