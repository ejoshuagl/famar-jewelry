import { db } from '@/lib/db'

let orderStockColumnReady: Promise<void> | null = null

export function ensureOrderStockReservationColumn() {
  orderStockColumnReady ||= db.$executeRawUnsafe(
    'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stockReserved" BOOLEAN NOT NULL DEFAULT false',
  ).then(() => undefined).catch((error) => {
    orderStockColumnReady = null
    throw error
  })
  return orderStockColumnReady
}
