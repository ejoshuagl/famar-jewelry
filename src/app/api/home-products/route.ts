import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { selectDailyFeatured } from '@/lib/daily-featured'

function pickRandom<T>(items: T[], count = 4) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result.slice(0, count)
}

const productInclude = { category: { select: { name: true, slug: true } } } as const

export async function GET() {
  try {
    const [eligible, newCandidates, bestCandidates] = await Promise.all([
      db.product.findMany({
        where: { visible: true, status: 'available', stock: { gt: 0 } },
        select: { id: true, isFeatured: true, featuredExcluded: true },
      }),
      db.product.findMany({
        where: { visible: true, status: 'available', stock: { gt: 0 }, isNew: true },
        orderBy: { createdAt: 'desc' },
        take: 16,
        include: productInclude,
      }),
      db.product.findMany({
        where: { visible: true, status: 'available', stock: { gt: 0 } },
        orderBy: { salesCount: 'desc' },
        take: 20,
        include: productInclude,
      }),
    ])

    const featuredIds = pickRandom(selectDailyFeatured(eligible), 4).map((product) => product.id)
    const featuredRows = featuredIds.length
      ? await db.product.findMany({ where: { id: { in: featuredIds } }, include: productInclude })
      : []
    const featuredById = new Map(featuredRows.map((product) => [product.id, product]))

    return NextResponse.json({
      featuredProducts: featuredIds.map((id) => featuredById.get(id)).filter(Boolean),
      newProducts: pickRandom(newCandidates),
      bestSelling: pickRandom(bestCandidates),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/home-products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
