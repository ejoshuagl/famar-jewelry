import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || ''
    const search = searchParams.get('search') || ''

    // Exact code lookup (admin use)
    if (code) {
      const product = await db.product.findUnique({
        where: { code: code.toUpperCase() },
        include: { category: { select: { name: true, slug: true } } },
      })
      if (!product) {
        return NextResponse.json({ product: null })
      }
      return NextResponse.json({ product })
    }

    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const featured = searchParams.get('featured') === 'true'
    const isNew = searchParams.get('new') === 'true'
    const isOnSale = searchParams.get('sale') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const sort = searchParams.get('sort') || 'relevance'

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ]
    }
    if (category) {
      where.category = { slug: category }
    }
    if (status) {
      where.status = status
    }
    if (featured) {
      where.isFeatured = true
    }
    if (isNew) {
      where.isNew = true
    }
    if (isOnSale) {
      where.isOnSale = true
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'price-asc') orderBy = { price: 'asc' }
    else if (sort === 'price-desc') orderBy = { price: 'desc' }
    else if (sort === 'newest') orderBy = { createdAt: 'desc' }
    else if (sort === 'best-selling') orderBy = { salesCount: 'desc' }
    else if (sort === 'name') orderBy = { name: 'asc' }

    const total = await db.product.count({ where })
    const products = await db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true, slug: true } } },
    })

    return NextResponse.json({
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET /api/products error:', error)
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
    const {
      name, code, description, categoryId, material, weight, dimensions,
      color, price, stock, status, mainImage, images, isFeatured,
      isNew, isOnSale, tags,
    } = body

    if (!name || !code || !categoryId || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        name, code, description, categoryId, material, weight, dimensions,
        color, price: parseFloat(price), stock: parseInt(stock) || 0,
        status: status || 'available', mainImage,
        images: images ? JSON.stringify(images) : null,
        isFeatured: !!isFeatured, isNew: !!isNew, isOnSale: !!isOnSale,
        tags: tags ? JSON.stringify(tags) : null,
      },
      include: { category: { select: { name: true, slug: true } } },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}