import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function dataUriBuffer(source: string) {
  const match = source.match(/^data:image\/[^;]+;base64,(.+)$/)
  return match ? Buffer.from(match[1], 'base64') : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id }, select: { mainImage: true } })
    if (!product?.mainImage) return new NextResponse(null, { status: 404 })

    let input = dataUriBuffer(product.mainImage)
    if (!input && /^https?:\/\//.test(product.mainImage)) {
      const response = await fetch(product.mainImage, { signal: AbortSignal.timeout(8_000) })
      if (!response.ok) return NextResponse.redirect(product.mainImage)
      input = Buffer.from(await response.arrayBuffer())
    }
    if (!input) return new NextResponse(null, { status: 404 })

    const thumbnail = await sharp(input)
      .rotate()
      .resize(160, 160, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 72 })
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
