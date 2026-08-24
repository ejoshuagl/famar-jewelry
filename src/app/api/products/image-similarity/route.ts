import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { createPerceptualHash, perceptualSimilarity, tryCreatePerceptualHash } from '@/lib/image-hash'

const MATCH_THRESHOLD = 0.78
const BATCH_SIZE = 8

export async function POST(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { image, excludeProductId } = await request.json()
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Imagen inválida' }, { status: 400 })
    }

    const candidateHash = await createPerceptualHash(image)

    // Existing products are indexed lazily. The first comparison may take a
    // little longer; subsequent checks use the stored 64-bit visual hash.
    const missingHashes = await db.product.findMany({
      where: { imageHash: null, mainImage: { not: null } },
      select: { id: true, mainImage: true },
    })
    for (let start = 0; start < missingHashes.length; start += BATCH_SIZE) {
      const batch = missingHashes.slice(start, start + BATCH_SIZE)
      await Promise.all(
        batch.map(async (product) => {
          const imageHash = await tryCreatePerceptualHash(product.mainImage)
          if (imageHash) {
            await db.product.update({ where: { id: product.id }, data: { imageHash } })
          }
        })
      )
    }

    const products = await db.product.findMany({
      where: {
        imageHash: { not: null },
        ...(excludeProductId ? { id: { not: String(excludeProductId) } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        mainImage: true,
        imageHash: true,
        category: { select: { name: true } },
      },
    })

    const matches = products
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        mainImage: product.mainImage,
        category: product.category.name,
        similarity: perceptualSimilarity(candidateHash, product.imageHash!),
      }))
      .filter((product) => product.similarity >= MATCH_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((product) => ({
        ...product,
        similarity: Math.round(product.similarity * 100),
      }))

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('POST /api/products/image-similarity error:', error)
    return NextResponse.json({ error: 'No se pudo comparar la imagen' }, { status: 500 })
  }
}
