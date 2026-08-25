import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, auditLog } from '@/lib/admin-auth'
import { getEcuadorDate, getEcuadorDayIndex, selectDailyFeatured } from '@/lib/daily-featured'
import { tryCreatePerceptualHash } from '@/lib/image-hash'
import { parseVariants, variantsStock } from '@/lib/product-variants'
import { ensureCampaignTable } from '@/lib/campaigns'
import { ensureProductRelations } from '@/lib/relations'

export async function GET(request: NextRequest) {
  try {
    await ensureProductRelations()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || ''
    const search = searchParams.get('search') || ''

    // Exact code lookup (admin use)
    if (code) {
      const product = await db.product.findUnique({
        where: { code: code.toUpperCase() },
        include: { category: { select: { name: true, slug: true } } },
      })
      if (!product) {
        return NextResponse.json({ product: null })
      }
      return NextResponse.json({ product })
    }

    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const featured = searchParams.get('featured') === 'true'
    const isNew = searchParams.get('new') === 'true'
    const isOnSale = searchParams.get('sale') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const sort = searchParams.get('sort') || 'relevance'
    const includeHidden = searchParams.get('all') === 'true'
    const flag = searchParams.get('flag') || ''
    const campaignId = searchParams.get('campaign') || ''

    const where: Record<string, unknown> = {}
    if (!includeHidden) {
      where.visible = true
    }
    if (campaignId) {
      await ensureCampaignTable()
      const now = new Date()
      const campaign = await db.campaign.findFirst({
        where: { id: campaignId, active: true, startAt: { lte: now }, endAt: { gte: now } },
        select: { products: { select: { productId: true } } },
      })
      const productIds = campaign?.products.map((product) => product.productId) || []
      where.id = { in: productIds }
    }
    if (flag === 'featured') where.isFeatured = true
    if (flag === 'new') where.isNew = true
    if (flag === 'sale') where.isOnSale = true
    if (flag === 'out_of_stock') where.status = 'out_of_stock'
    if (flag === 'hidden') where.visible = false
    // Palabras clave en la búsqueda que equivalen a una etiqueta
    const flagWords: Record<string, string> = {
      nuevo: 'new', nuevos: 'new', nueva: 'new',
      destacado: 'featured', destacados: 'featured',
      oferta: 'sale', ofertas: 'sale',
      agotado: 'out_of_stock', agotados: 'out_of_stock',
      oculto: 'hidden', ocultos: 'hidden',
    }
    const searchFlag = flagWords[search.toLowerCase()]
    if (searchFlag === 'new') where.isNew = true
    if (searchFlag === 'featured') where.isFeatured = true
    if (searchFlag === 'sale') where.isOnSale = true
    if (searchFlag === 'out_of_stock') where.status = 'out_of_stock'
    if (searchFlag === 'hidden') where.visible = false
    if (search && !searchFlag) {
      const q = { contains: search, mode: 'insensitive' }
      where.OR = [
        { name: q },
        { code: q },
        { description: q },
        { material: q },
        { color: q },
      ]
    }
    if (category) {
      where.category = { slug: category }
    }
    if (status) {
      where.status = status
    }
    // `featured=true` is the public daily rotation. Manual featured flags are
    // still available through `flag=featured` in the admin catalog.
    if (isNew) {
      where.isNew = true
    }
    if (isOnSale) {
      where.isOnSale = true
    }

    // Always prioritize in-stock products first, then apply selected sort
    const baseOrderBy: Record<string, string> = sort === 'price-asc' ? { price: 'asc' }
      : sort === 'price-desc' ? { price: 'desc' }
      : sort === 'newest' ? { createdAt: 'desc' }
      : sort === 'best-selling' ? { salesCount: 'desc' }
      : sort === 'name' ? { name: 'asc' }
      : { createdAt: 'desc' }

    const orderBy = [{ status: 'asc' }, baseOrderBy]

    if (featured || flag === 'daily-featured') {
      // Calculate today's rotation from the complete eligible catalog first.
      // Category, search and other active filters must narrow that fixed set,
      // never generate a different rotation of their own.
      const eligibleProducts = await db.product.findMany({
        where: { visible: true, status: 'available', stock: { gt: 0 } },
        include: { category: { select: { name: true, slug: true } } },
      })
      const dayIndex = getEcuadorDayIndex()
      const dailySelection = selectDailyFeatured(eligibleProducts, dayIndex)
      const dailyIds = dailySelection.map((product) => product.id)
      const matchingProducts = await db.product.findMany({
        where: { AND: [where, { id: { in: dailyIds } }] },
        include: { category: { select: { name: true, slug: true } } },
      })
      const matchingById = new Map(matchingProducts.map((product) => [product.id, product]))
      const dailyProducts = dailyIds
        .map((id) => matchingById.get(id))
        .filter((product): product is NonNullable<typeof product> => Boolean(product))
      const dailyCount = dailyProducts.length
      const pageStart = (page - 1) * limit

      return NextResponse.json({
        products: dailyProducts.slice(pageStart, pageStart + limit),
        total: dailyCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(dailyCount / limit)),
        rotationDate: getEcuadorDate(dayIndex),
      })
    }

    const total = await db.product.count({ where })
    const products = await db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true, slug: true } } },
    })

    let responseProducts = products
    if (includeHidden) {
      const eligibleIds = await db.product.findMany({
        where: { visible: true, status: 'available', stock: { gt: 0 } },
        select: { id: true, isFeatured: true, featuredExcluded: true },
      })
      const dailyIds = new Set(selectDailyFeatured(eligibleIds).map((product) => product.id))
      responseProducts = products.map((product) => ({
        ...product,
        isDailyFeatured: dailyIds.has(product.id),
      }))
    }

    return NextResponse.json({
      products: responseProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureProductRelations()
    const admin = requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const adminName = admin.name

    const body = await request.json()
    const {
      name, code, description, categoryId, material, weight, dimensions,
      color, price, stock, mainImage, images, variants, isFeatured,
      isNew, isOnSale, visible, featuredExcluded,
    } = body

    if (!name || !code || !categoryId || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validaciones básicas
    const priceValue = parseFloat(price)
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100000) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
    }
    if (String(name).length > 120 || String(code).length > 30) {
      return NextResponse.json({ error: 'Nombre o código demasiado largo' }, { status: 400 })
    }
    const parsedVariants = parseVariants(variants)
    const stockCount = parsedVariants.length
      ? variantsStock(parsedVariants)
      : Math.max(0, Math.min(parseInt(stock) || 0, 100000))

    const imageHash = await tryCreatePerceptualHash(mainImage)
    const product = await db.product.create({
      data: {
        name, code, description, categoryId, material, weight, dimensions,
        color, price: priceValue, stock: stockCount,
        status: stockCount <= 0 ? 'out_of_stock' : 'available', mainImage,
        imageHash,
        images: images ? JSON.stringify(images) : null,
        variants: parsedVariants.length ? JSON.stringify(parsedVariants) : null,
        isFeatured: !!isFeatured, isNew: !!isNew, isOnSale: !!isOnSale,
        featuredExcluded: !!featuredExcluded,
        visible: visible === undefined ? true : !!visible,
      },
      include: { category: { select: { name: true, slug: true } } },
    })

    await auditLog({
      action: 'create',
      entity: 'product',
      entityId: product.id,
      admin: adminName,
      details: `${product.name} (${product.code}) precio=$${product.price} stock=${product.stock}`,
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
