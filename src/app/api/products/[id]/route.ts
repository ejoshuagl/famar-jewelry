import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { tryCreatePerceptualHash } from '@/lib/image-hash'
import { parseVariants, variantsStock } from '@/lib/product-variants'
import { firstAvailableProductCode, productCodePrefix } from '@/lib/product-codes'
import { persistProductGallery, persistProductImage, persistVariantImages } from '@/lib/product-image-storage'
import { getDailySaleSelection, withDailySale } from '@/lib/daily-sales'

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
    const admin = await requireAdmin(request)
    if (!product.visible && !admin) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const dailySale = await getDailySaleSelection()
    const productWithSale = withDailySale(product, dailySale.ids)
    if (request.nextUrl.searchParams.get('mobile') === 'true') {
      let gallery: string[] = []
      try { gallery = product.images ? JSON.parse(product.images) : [] } catch { gallery = [] }
      const version = product.updatedAt.getTime()
      const imageBase = `/api/products/${product.id}/thumbnail`
      return NextResponse.json({
        ...productWithSale,
        mainImage: `${imageBase}?size=960&v=${version}`,
        images: JSON.stringify(gallery.map((_, index) => `${imageBase}?gallery=${index}&size=960&v=${version}`)),
        variants: JSON.stringify(parseVariants(product.variants).map((variant) => ({
          ...variant,
          image: variant.image ? `${imageBase}?variant=${encodeURIComponent(variant.id)}&size=960&v=${version}` : null,
        }))),
      }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' } })
    }
    return NextResponse.json(productWithSale)
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
    const admin = await requireAdmin(request, 'products')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const body = await request.json()
    const {
      name, description, categoryId, investmentId, material, weight, dimensions,
      color, price, stock, status, mainImage, images, variants, isFeatured,
      isNew, isOnSale, isForMen, visible, featuredExcluded,
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
    const storedMainImage = mainImage !== undefined ? await persistProductImage(mainImage) : undefined
    const storedImages = images !== undefined ? await persistProductGallery(images) : undefined
    const storedVariants = parsedVariants !== undefined ? await persistVariantImages(parsedVariants) : undefined
    const stockCount = storedVariants?.length
      ? variantsStock(storedVariants)
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
      if (investmentId && !await tx.investment.findUnique({ where: { id: investmentId }, select: { id: true } })) throw new Error('INVESTMENT_NOT_FOUND')
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
        ...(investmentId !== undefined && { investmentId: investmentId || null }),
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
        ...(storedMainImage !== undefined && { mainImage: storedMainImage }),
        ...(imageHash !== undefined && { imageHash }),
        ...(storedImages !== undefined && { images: storedImages.length ? JSON.stringify(storedImages) : null }),
        ...(storedVariants !== undefined && { variants: storedVariants.length ? JSON.stringify(storedVariants) : null }),
        ...(isFeatured !== undefined && { isFeatured: !!isFeatured }),
        ...(featuredExcluded !== undefined && { featuredExcluded: !!featuredExcluded }),
        ...(isNew !== undefined && { isNew: !!isNew }),
        ...(isOnSale !== undefined && { isOnSale: !!isOnSale }),
        ...(isForMen !== undefined && { isForMen: !!isForMen }),
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
    if (previous.isForMen !== product.isForMen) changes.push('para hombres')
    if (previous.categoryId !== product.categoryId) changes.push(`categoría y código ${previous.code}→${product.code}`)
    if (previous.investmentId !== product.investmentId) changes.push('lote de inversión')
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
    if (error instanceof Error && error.message === 'INVESTMENT_NOT_FOUND') return NextResponse.json({ error: 'Lote de inversión inválido' }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request, 'products')
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const { id } = await params
    const result = await db.$transaction(async (tx) => {
      const target = await tx.product.findUnique({ where: { id } })
      if (!target) return null

      const historicalItems = await tx.orderItem.count({ where: { productId: id } })
      if (historicalItems > 0) {
        const archivedVariants = parseVariants(target.variants).map((variant) => ({
          ...variant,
          stock: 0,
        }))
        const archived = await tx.product.update({
          where: { id },
          data: {
            visible: false,
            status: 'discontinued',
            stock: 0,
            isFeatured: false,
            featuredExcluded: true,
            isNew: false,
            isOnSale: false,
            ...(archivedVariants.length ? { variants: JSON.stringify(archivedVariants) } : {}),
          },
        })
        return { target: archived, archived: true, historicalItems }
      }

      await tx.product.delete({ where: { id } })
      return { target, archived: false, historicalItems: 0 }
    })
    if (!result) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    await auditLog({
      action: result.archived ? 'archive' : 'delete',
      entity: 'product',
      entityId: id,
      admin: adminName,
      details: result.archived
        ? `${result.target.name} (${result.target.code}), conservado por ${result.historicalItems} registro(s) de pedido`
        : `${result.target.name} (${result.target.code})`,
    })
    return NextResponse.json({ success: true, archived: result.archived })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
