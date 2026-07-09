import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('GET /api/categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, image, order } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        image: image || null,
        order: order || 0,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('POST /api/categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}