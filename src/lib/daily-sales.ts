import 'server-only'

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'

export interface DailySaleSettings {
  active: boolean
  count: number
  categoryIds: string[]
  rotation: number
  campaignId: string | null
}

export const DEFAULT_DAILY_SALE_SETTINGS: DailySaleSettings = {
  active: false,
  count: 25,
  categoryIds: [],
  rotation: 0,
  campaignId: null,
}

export async function getDailySaleSettings(): Promise<DailySaleSettings> {
  const row = await db.commerceSetting.findUnique({ where: { key: 'daily-sale-settings' }, select: { value: true } })
  if (!row) return DEFAULT_DAILY_SALE_SETTINGS
  try {
    const value = JSON.parse(row.value)
    return {
      active: value.active === true,
      count: Math.min(100, Math.max(1, Number.parseInt(String(value.count)) || 25)),
      categoryIds: Array.isArray(value.categoryIds) ? value.categoryIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100) : [],
      rotation: Math.max(0, Number.parseInt(String(value.rotation)) || 0),
      campaignId: typeof value.campaignId === 'string' && value.campaignId ? value.campaignId : null,
    }
  } catch {
    return DEFAULT_DAILY_SALE_SETTINGS
  }
}

export async function saveDailySaleSettings(settings: DailySaleSettings) {
  await db.commerceSetting.upsert({
    where: { key: 'daily-sale-settings' },
    update: { value: JSON.stringify(settings) },
    create: { key: 'daily-sale-settings', value: JSON.stringify(settings) },
  })
  return settings
}

function ecuadorDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function getDailySaleSelection(settings?: DailySaleSettings) {
  const config = settings || await getDailySaleSettings()
  if (!config.active) return { settings: config, date: ecuadorDate(), ids: new Set<string>(), products: [] as Array<{ id: string; code: string; name: string }> }

  const candidates = await db.product.findMany({
    where: {
      visible: true,
      status: 'available',
      stock: { gt: 0 },
      isOnSale: false,
      ...(config.categoryIds.length ? { categoryId: { in: config.categoryIds } } : {}),
    },
    select: { id: true, code: true, name: true },
  })
  const date = ecuadorDate()
  const products = candidates
    .map((product) => ({ product, score: createHash('sha256').update(`${date}:${config.rotation}:${product.id}`).digest('hex') }))
    .sort((a, b) => a.score.localeCompare(b.score))
    .slice(0, config.count)
    .map(({ product }) => product)
  return { settings: config, date, ids: new Set(products.map((product) => product.id)), products }
}

export function withDailySale<T extends { id: string; isOnSale: boolean }>(product: T, selectedIds: Set<string>) {
  const isDailySale = selectedIds.has(product.id)
  return { ...product, isOnSale: product.isOnSale || isDailySale, isDailySale }
}
