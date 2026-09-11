import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { parseVariants } from '@/lib/product-variants'
import { requireAdmin } from '@/lib/admin-auth'
import { decodeDataImage, downloadTrustedImage } from '@/lib/safe-image-source'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id }, select: { visible: true, mainImage: true, images: true, variants: true } })
    if (!product || (!product.visible && !await requireAdmin(request))) return new NextResponse(null, { status: 404 })
    const searchParams = new URL(request.url).searchParams
    const variantId = searchParams.get('variant')
    const galleryIndex = Number.parseInt(searchParams.get('gallery') || '', 10)
    const requestedSize = Number.parseInt(searchParams.get('size') || '480', 10)
    const size = Math.min(1200, Math.max(240, Number.isFinite(requestedSize) ? requestedSize : 480))
    let gallery: string[] = []
    try { gallery = product?.images ? JSON.parse(product.images) : [] } catch { gallery = [] }
    const source = variantId
      ? parseVariants(product?.variants).find((variant) => variant.id === variantId)?.image
      : Number.isInteger(galleryIndex) && galleryIndex >= 0
        ? gallery[galleryIndex]
        : product?.mainImage
    if (!source) return new NextResponse(null, { status: 404 })

    let input = decodeDataImage(source)
    if (!input && /^https?:\/\//.test(source)) {
      input = await downloadTrustedImage(source)
    }
    if (!input) return new NextResponse(null, { status: 404 })

    const thumbnail = await sharp(input)
      .rotate()
      .resize(size, size, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: size >= 900 ? 84 : 78, smartSubsample: true })
      .toBuffer()

    return new NextResponse(new Uint8Array(thumbnail), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('GET product thumbnail error:', error)
    return new NextResponse(null, { status: 404 })
  }
}
