export interface ProductVariant {
  id: string
  name: string
  image: string
  stock: number
}

export function parseVariants(value: unknown): ProductVariant[] {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((variant) => ({
        id: String(variant?.id || ''),
        name: String(variant?.name || '').trim(),
        image: String(variant?.image || ''),
        stock: Math.max(0, Number.parseInt(String(variant?.stock ?? 0)) || 0),
      }))
      .filter((variant) => variant.id && variant.name)
  } catch {
    return []
  }
}

export function variantsStock(variants: ProductVariant[]) {
  return variants.reduce((total, variant) => total + variant.stock, 0)
}
