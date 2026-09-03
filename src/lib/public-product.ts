import { parseVariants } from '@/lib/product-variants'

type PublicProduct = {
  id: string
  mainImage?: string | null
  variants?: string | null
  updatedAt?: Date
}

export function withPublicThumbnails<T extends PublicProduct>(product: T) {
  const version = product.updatedAt instanceof Date ? `?v=${product.updatedAt.getTime()}` : ''
  const variantSeparator = version ? '&' : '?'
  return {
    ...product,
    mainImage: `/api/products/${product.id}/thumbnail${version}`,
    variants: product.variants
      ? JSON.stringify(parseVariants(product.variants).map((variant) => ({
          ...variant,
          image: variant.image
            ? `/api/products/${product.id}/thumbnail${version}${variantSeparator}variant=${encodeURIComponent(variant.id)}`
            : null,
        })))
      : product.variants,
  }
}
