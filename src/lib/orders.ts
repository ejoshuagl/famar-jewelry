import { db } from '@/lib/db'

let orderStockColumnReady: Promise<void> | null = null

export function ensureOrderStockReservationColumn() {
  orderStockColumnReady ||= db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stockReserved" BOOLEAN NOT NULL DEFAULT false',
    )
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('famar-order-number'))`
    const migration = await tx.commerceSetting.findUnique({
      where: { key: 'order_numbers_sequential_v1' },
      select: { key: true },
    })
    if (!migration) {
      // Use temporary unique values first, then renumber chronologically.
      await tx.$executeRawUnsafe(`UPDATE "Order" SET "orderNumber" = 'TMP-' || "id"`)
      await tx.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequence
          FROM "Order"
        )
        UPDATE "Order" AS orders
        SET "orderNumber" = 'FAM-' || LPAD(ranked.sequence::text, 6, '0')
        FROM ranked
        WHERE orders."id" = ranked."id"
      `)
      await tx.commerceSetting.create({
        data: { key: 'order_numbers_sequential_v1', value: new Date().toISOString() },
      })
    }
  }).then(() => undefined).catch((error) => {
    orderStockColumnReady = null
    throw error
  })
  return orderStockColumnReady
}
