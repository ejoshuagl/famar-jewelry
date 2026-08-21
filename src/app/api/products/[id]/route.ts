import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({
      where: { id },
      include: { category: { select: { name: true, slug: true } } },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name, code, description, categoryId, material, weight, dimensions,
      color, price, stock, status, mainImage, images, isFeatured,
      isNew, isOnSale, tags, visible,
    } = body

    const product = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(material !== undefined && { material }),
        ...(weight !== undefined && { weight }),
        ...(dimensions !== undefined && { dimensions }),
        ...(color !== undefined && { color }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stock !== undefined && {
          stock: parseInt(stock),
          // El estado se deriva del stock, no se cambia a mano
          status: parseInt(stock) <= 0 ? 'out_of_stock' : 'available',
        }),
        ...(mainImage !== undefined && { mainImage }),
        ...(images !== undefined && { images: images ? JSON.stringify(images) : null }),
        ...(isFeatured !== undefined && { isFeatured: !!isFeatured }),
        ...(isNew !== undefined && { isNew: !!isNew }),
        ...(isOnSale !== undefined && { isOnSale: !!isOnSale }),
        ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
        ...(visible !== undefined && { visible: !!visible }),
      },
      include: { category: { select: { name: true, slug: true } } },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await db.orderItem.deleteMany({ where: { productId: id } })
    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}