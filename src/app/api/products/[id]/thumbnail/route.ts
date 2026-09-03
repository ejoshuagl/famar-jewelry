import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { parseVariants } from '@/lib/product-variants'

export const runtime = 'nodejs'

function dataUriBuffer(source: string) {
  const match = source.match(/^data:image\/[^;]+;base64,(.+)$/)
  return match ? Buffer.from(match[1], 'base64') : null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id }, select: { mainImage: true, variants: true } })
    const variantId = new URL(request.url).searchParams.get('variant')
    const source = variantId
      ? parseVariants(product?.variants).find((variant) => variant.id === variantId)?.image
      : product?.mainImage
    if (!source) return new NextResponse(null, { status: 404 })

    let input = dataUriBuffer(source)
    if (!input && /^https?:\/\//.test(source)) {
      const response = await fetch(source, { signal: AbortSignal.timeout(8_000) })
      if (!response.ok) return NextResponse.redirect(source)
      input = Buffer.from(await response.arrayBuffer())
    }
    if (!input) return new NextResponse(null, { status: 404 })

    const thumbnail = await sharp(input)
      .rotate()
      // Product cards can reach ~300 CSS pixels and many phones render at
      // 2x/3x density. A 160 px source looked soft after being enlarged.
      .resize(640, 640, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 82, smartSubsample: true })
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
