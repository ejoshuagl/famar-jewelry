export const DAILY_FEATURED_COUNT = 25

const ECUADOR_UTC_OFFSET_MS = 5 * 60 * 60 * 1000

function stableProductHash(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getEcuadorDayIndex(now = Date.now()) {
  return Math.floor((now - ECUADOR_UTC_OFFSET_MS) / 86_400_000)
}

export function getEcuadorDate(dayIndex: number) {
  return new Date(dayIndex * 86_400_000).toISOString().slice(0, 10)
}

export function selectDailyFeatured<
  T extends { id: string; isFeatured?: boolean; featuredExcluded?: boolean }
>(
  products: T[],
  dayIndex = getEcuadorDayIndex()
) {
  const eligible = products.filter((product) => !product.featuredExcluded)
  const pinned = eligible
    .filter((product) => product.isFeatured)
    .sort((a, b) => stableProductHash(a.id) - stableProductHash(b.id))
    .slice(0, DAILY_FEATURED_COUNT)
  const ordered = eligible
    .filter((product) => !product.isFeatured)
    .sort(
    (a, b) => stableProductHash(a.id) - stableProductHash(b.id)
  )
  const count = Math.min(DAILY_FEATURED_COUNT - pinned.length, ordered.length)
  const start = ordered.length
    ? (dayIndex * DAILY_FEATURED_COUNT) % ordered.length
    : 0

  const automatic = Array.from(
    { length: count },
    (_, index) => ordered[(start + index) % ordered.length]
  )

  return [...pinned, ...automatic]
}
