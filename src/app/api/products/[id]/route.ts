import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { tryCreatePerceptualHash } from '@/lib/image-hash'
import { parseVariants, variantsStock } from '@/lib/product-variants'
import { firstAvailableProductCode, productCodePrefix } from '@/lib/product-codes'

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
    const admin = requireAdmin(request, 'products')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const body = await request.json()
    const {
      name, description, categoryId, material, weight, dimensions,
      color, price, stock, status, mainImage, images, variants, isFeatured,
      isNew, isOnSale, visible, featuredExcluded,
    } = body

    // Validaciones básicas
    if (price !== undefined) {
      const p = parseFloat(price)
      if (!Number.isFinite(p) || p < 0 || p > 100000) {
        return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
      }
    }
    if (name !== undefined && String(name).length > 120) {
      return NextResponse.json({ error: 'Nombre demasiado largo' }, { status: 400 })
    }
    const parsedVariants = variants !== undefined ? parseVariants(variants) : undefined
    const stockCount = parsedVariants?.length
      ? variantsStock(parsedVariants)
      : stock !== undefined ? Math.max(0, Math.min(parseInt(stock) || 0, 100000)) : undefined

    const previous = await db.product.findUnique({ where: { id } })
    if (!previous) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const imageHash = mainImage !== undefined
      ? await tryCreatePerceptualHash(mainImage)
      : undefined
    const product = await db.$transaction(async (tx) => {
      let nextCode = previous.code
      if (categoryId !== undefined && categoryId !== previous.categoryId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`famar-product-code:${categoryId}`}))`
        const category = await tx.category.findUnique({
          where: { id: categoryId },
          select: { slug: true },
        })
        if (!category) throw new Error('CATEGORY_NOT_FOUND')
        nextCode = await firstAvailableProductCode(tx, productCodePrefix(category.slug))
      }

      return tx.product.update({
        where: { id },
        data: {
        ...(name !== undefined && { name }),
        ...(nextCode !== previous.code && { code: nextCode }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(material !== undefined && { material }),
        ...(weight !== undefined && { weight }),
        ...(dimensions !== undefined && { dimensions }),
        ...(color !== undefined && { color }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stockCount !== undefined && {
          stock: stockCount,
          // El estado se deriva del stock, no se cambia a mano
          status: stockCount <= 0 ? 'out_of_stock' : 'available',
        }),
        ...(mainImage !== undefined && { mainImage }),
        ...(imageHash !== undefined && { imageHash }),
        ...(images !== undefined && { images: images ? JSON.stringify(images) : null }),
        ...(variants !== undefined && { variants: parsedVariants?.length ? JSON.stringify(parsedVariants) : null }),
        ...(isFeatured !== undefined && { isFeatured: !!isFeatured }),
        ...(featuredExcluded !== undefined && { featuredExcluded: !!featuredExcluded }),
        ...(isNew !== undefined && { isNew: !!isNew }),
        ...(isOnSale !== undefined && { isOnSale: !!isOnSale }),
        ...(visible !== undefined && { visible: !!visible }),
        },
        include: { category: { select: { name: true, slug: true } } },
      })
    })

    // Auditoría de cambios relevantes (precio, stock, visibilidad, etc.)
    const changes: string[] = []
    if (previous.price !== product.price) changes.push(`precio $${previous.price}→$${product.price}`)
    if (previous.stock !== product.stock) changes.push(`stock ${previous.stock}→${product.stock}`)
    if (previous.visible !== product.visible) changes.push(`visible ${previous.visible}→${product.visible}`)
    if (previous.isFeatured !== product.isFeatured) changes.push('destacado')
    if (previous.featuredExcluded !== product.featuredExcluded) changes.push('exclusión de destacados')
    if (previous.isNew !== product.isNew) changes.push('nuevo')
    if (previous.isOnSale !== product.isOnSale) changes.push('oferta')
    if (previous.categoryId !== product.categoryId) changes.push(`categoría y código ${previous.code}→${product.code}`)
    await auditLog({
      action: 'update',
      entity: 'product',
      entityId: product.id,
      admin: adminName,
      details: `${product.name} (${product.code})${changes.length ? ': ' + changes.join(', ') : ''}`,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error)
    if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdmin(request, 'products')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const target = await db.product.findUnique({ where: { id } })
    await db.orderItem.deleteMany({ where: { productId: id } })
    await db.product.delete({ where: { id } })
    if (target) {
      await auditLog({
        action: 'delete',
        entity: 'product',
        entityId: id,
        admin: adminName,
        details: `${target.name} (${target.code})`,
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
