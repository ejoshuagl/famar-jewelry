import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
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

    // Extract 2-letter prefix from slug (first 2 chars, uppercase)
    const prefix = category.slug.substring(0, 2).toUpperCase()
    const codePrefix = `FAM-${prefix}`

    const rows = await db.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(SUBSTRING("code" FROM '[0-9]+$')::bigint) AS max
      FROM "Product"
      WHERE "code" LIKE ${`${codePrefix}%`}
        AND "code" ~ ${`^${codePrefix}[0-9]+$`}
    `
    const nextNum = Number(rows[0]?.max || 0) + 1

    const nextCode = `${codePrefix}${String(nextNum).padStart(3, '0')}`

    return NextResponse.json({ code: nextCode })
  } catch (error) {
    console.error('GET /api/products/next-code error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
