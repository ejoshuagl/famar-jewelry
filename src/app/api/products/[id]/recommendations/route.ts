import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const complementaryCategories: Record<string, string[]> = {
  aretes: ['collares', 'pulseras', 'anillos', 'sets'],
  collares: ['aretes', 'pulseras', 'anillos', 'sets'],
  pulseras: ['anillos', 'collares', 'aretes', 'sets'],
  anillos: ['pulseras', 'aretes', 'collares', 'sets'],
  sets: ['aretes', 'anillos', 'pulseras', 'collares'],
  tobilleras: ['pulseras', 'anillos', 'aretes', 'collares'],
}

const styleWords = [
  'corazon',
  'flor',
  'mariposa',
  'perla',
  'cristal',
  'minimalista',
  'geometrico',
  'vintage',
  'estrella',
  'luna',
  'trebol',
  'espiral',
  'cadena',
]

function normalize(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getStyleMatches(source: string, candidate: string) {
  return styleWords.filter((word) => source.includes(word) && candidate.includes(word)).length
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit') || 8)
    const limit = Math.min(Math.max(requestedLimit, 1), 12)

    const current = await db.product.findUnique({
      where: { id },
      include: { category: { select: { slug: true } } },
    })

    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const candidates = await db.product.findMany({
      where: {
        id: { not: current.id },
        visible: true,
        status: 'available',
        stock: { gt: 0 },
      },
      include: { category: { select: { name: true, slug: true } } },
      orderBy: [{ salesCount: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    })

    const preferred = complementaryCategories[current.category.slug] || []
    const currentMaterial = normalize(current.material)
    const currentColor = normalize(current.color)
    const currentStyle = normalize(`${current.name} ${current.description || ''}`)

    const scored = candidates
      .map((product) => {
        const categoryIndex = preferred.indexOf(product.category.slug)
        const material = normalize(product.material)
        const color = normalize(product.color)
        const style = normalize(`${product.name} ${product.description || ''}`)
        const priceDistance = Math.abs(product.price - current.price) / Math.max(current.price, 1)

        let score = 0
        if (categoryIndex >= 0) score += 28 - categoryIndex * 3
        if (product.category.slug !== current.category.slug) score += 12
        if (currentMaterial && material && (material.includes(currentMaterial) || currentMaterial.includes(material))) score += 18
        if (currentColor && color && (color.includes(currentColor) || currentColor.includes(color))) score += 22
        score += getStyleMatches(currentStyle, style) * 14
        score += Math.max(0, 12 - priceDistance * 10)
        score += Math.min(product.salesCount, 20) * 0.35
        if (product.isFeatured) score += 5
        if (product.isOnSale) score += 4
        if (product.isNew) score += 2

        return { product, score }
      })
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))

    const recommendations: typeof candidates = []
    const selectedIds = new Set<string>()
    const categoryCounts = new Map<string, number>()

    // First show the best match from every complementary category.
    for (const category of preferred) {
      const match = scored.find(
        ({ product }) => product.category.slug === category && !selectedIds.has(product.id)
      )
      if (!match || recommendations.length >= limit) continue
      recommendations.push(match.product)
      selectedIds.add(match.product.id)
      categoryCounts.set(category, 1)
    }

    // Fill the grid with the strongest matches, limiting repeated categories.
    for (const { product } of scored) {
      if (recommendations.length >= limit) break
      if (selectedIds.has(product.id)) continue
      const count = categoryCounts.get(product.category.slug) || 0
      if (count >= 2) continue
      recommendations.push(product)
      selectedIds.add(product.id)
      categoryCounts.set(product.category.slug, count + 1)
    }

    // Small catalogs may not have enough categories, so fill any remaining slots.
    for (const { product } of scored) {
      if (recommendations.length >= limit) break
      if (selectedIds.has(product.id)) continue
      recommendations.push(product)
      selectedIds.add(product.id)
    }

    return NextResponse.json({ products: recommendations })
  } catch (error) {
    console.error('GET /api/products/[id]/recommendations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
