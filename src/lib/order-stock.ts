import type { Prisma } from '@prisma/client'
import { parseVariants, variantsStock } from '@/lib/product-variants'

type StockItem = { productId: string; quantity: number; variantId?: string | null }

export async function adjustOrderStock(
  tx: Prisma.TransactionClient,
  items: StockItem[],
  operation: 'reserve' | 'restore',
) {
  const grouped = new Map<string, StockItem>()
  for (const item of items) {
    const key = `${item.productId}:${item.variantId || ''}`
    const current = grouped.get(key)
    grouped.set(key, { ...item, quantity: (current?.quantity || 0) + item.quantity })
  }
  const normalized = [...grouped.values()]
  const productIds = [...new Set(normalized.map((item) => item.productId))].sort()
  if (!productIds.length) return

  await tx.$queryRawUnsafe(
    `SELECT "id" FROM "Product" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE`,
    productIds,
  )
  const products = await tx.product.findMany({ where: { id: { in: productIds } } })
  const productMap = new Map(products.map((product) => [product.id, product]))

  for (const item of normalized) {
    const product = productMap.get(item.productId)
    if (!product) throw new Error('PRODUCT_UNAVAILABLE')
    const variants = parseVariants(product.variants)
    const amount = operation === 'reserve' ? -item.quantity : item.quantity

    if (item.variantId) {
      const variant = variants.find((entry) => entry.id === item.variantId)
      if (!variant) throw new Error('VARIANT_INVALID')
      if (operation === 'reserve' && variant.stock < item.quantity) throw new Error('INSUFFICIENT_STOCK')
      variant.stock = Math.max(0, variant.stock + amount)
      const stock = variantsStock(variants)
      await tx.product.update({
        where: { id: product.id },
        data: { variants: JSON.stringify(variants), stock, status: stock > 0 ? 'available' : 'out_of_stock' },
      })
      product.variants = JSON.stringify(variants)
      product.stock = stock
      product.status = stock > 0 ? 'available' : 'out_of_stock'
      continue
    }

    if (operation === 'reserve' && product.stock < item.quantity) throw new Error('INSUFFICIENT_STOCK')
    const stock = Math.max(0, product.stock + amount)
    await tx.product.update({
      where: { id: product.id },
      data: { stock, status: stock > 0 ? 'available' : 'out_of_stock' },
    })
    product.stock = stock
    product.status = stock > 0 ? 'available' : 'out_of_stock'
  }
}
