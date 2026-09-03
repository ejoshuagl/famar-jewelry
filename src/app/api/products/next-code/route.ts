import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { firstAvailableProductCode, productCodePrefix } from '@/lib/product-codes'

export async function GET(request: NextRequest) {
  try {
    if (!requireAdmin(request, 'products')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const codePrefix = productCodePrefix(category.slug)
    const nextCode = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`famar-product-code:${categoryId}`}))`
      return firstAvailableProductCode(tx, codePrefix)
    })

    return NextResponse.json({ code: nextCode })
  } catch (error) {
    console.error('GET /api/products/next-code error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
