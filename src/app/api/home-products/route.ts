import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { selectDailyFeatured } from '@/lib/daily-featured'
import { withPublicThumbnails } from '@/lib/public-product'
import { getDailySaleSelection, withDailySale } from '@/lib/daily-sales'

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
    const [eligible, newCandidates, manualSaleCandidates, dailySale] = await Promise.all([
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
        where: { visible: true, status: 'available', stock: { gt: 0 }, isOnSale: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: productInclude,
      }),
      getDailySaleSelection(),
    ])
    const publicProduct = <T extends Parameters<typeof withDailySale>[0]>(product: T) => withPublicThumbnails(withDailySale(product, dailySale.ids))

    const featuredIds = pickRandom(selectDailyFeatured(eligible), 4).map((product) => product.id)
    const automaticSaleIds = [...dailySale.ids]
    const [featuredRows, automaticSaleRows] = await Promise.all([
      db.product.findMany({ where: { id: { in: featuredIds } }, include: productInclude }),
      db.product.findMany({ where: { id: { in: automaticSaleIds } }, include: productInclude }),
    ])
    const featuredById = new Map(featuredRows.map((product) => [product.id, product]))
    const saleById = new Map<string, (typeof manualSaleCandidates)[number]>()
    for (const product of manualSaleCandidates) saleById.set(product.id, product)
    for (const product of automaticSaleRows) saleById.set(product.id, product)

    return NextResponse.json({
      featuredProducts: featuredIds.map((id) => featuredById.get(id)).filter((product): product is NonNullable<typeof product> => Boolean(product)).map(publicProduct),
      newProducts: pickRandom(newCandidates).map(publicProduct),
      offers: pickRandom([...saleById.values()]).map(publicProduct),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/home-products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
