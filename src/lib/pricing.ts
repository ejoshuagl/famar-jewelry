export const DEFAULT_SALE_DISCOUNT = 25

export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function salePrice(basePrice: number, isOnSale: boolean, discount = DEFAULT_SALE_DISCOUNT) {
  if (!isOnSale) return money(basePrice)
  const safeDiscount = Math.min(90, Math.max(0, discount))
  return money(basePrice * (1 - safeDiscount / 100))
}
