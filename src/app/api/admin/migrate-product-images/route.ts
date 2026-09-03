import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { persistProductGallery, persistProductImage, persistVariantImages } from '@/lib/product-image-storage'
import { parseVariants } from '@/lib/product-variants'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.MIGRATION_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const products = await db.product.findMany({
      where: {
        OR: [
          { mainImage: { startsWith: 'data:image/' } },
          { images: { contains: 'data:image/' } },
          { variants: { contains: 'data:image/' } },
        ],
      },
      orderBy: { code: 'asc' },
      take: 5,
    })

    let migrated = 0
    for (const product of products) {
      await db.$executeRawUnsafe(
        `INSERT INTO "ProductImageMigrationBackup" ("productId", "mainImage", images, variants)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("productId") DO NOTHING`,
        product.id, product.mainImage, product.images, product.variants
      )

      const folder = `products/${product.code}`
      const gallery = product.images ? (() => {
        try { return JSON.parse(product.images) as unknown[] } catch { return [] }
      })() : []
      const variants = parseVariants(product.variants)
      const [mainImage, images, storedVariants] = await Promise.all([
        persistProductImage(product.mainImage, folder),
        persistProductGallery(gallery, folder),
        persistVariantImages(variants, folder),
      ])

      await db.product.update({
        where: { id: product.id },
        data: {
          mainImage: mainImage || null,
          images: images.length ? JSON.stringify(images) : null,
          variants: storedVariants.length ? JSON.stringify(storedVariants) : null,
        },
      })
      migrated++
    }

    const remaining = await db.product.count({
      where: {
        OR: [
          { mainImage: { startsWith: 'data:image/' } },
          { images: { contains: 'data:image/' } },
          { variants: { contains: 'data:image/' } },
        ],
      },
    })

    return NextResponse.json({ migrated, remaining })
  } catch (error) {
    console.error('Product image migration failed:', error)
    return NextResponse.json({ error: 'Falló el lote de migración' }, { status: 500 })
  }
}
