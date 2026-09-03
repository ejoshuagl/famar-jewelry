import { parseVariants } from '@/lib/product-variants'

type PublicProduct = {
  id: string
  mainImage?: string | null
  variants?: string | null
  updatedAt?: Date
}

export function withPublicThumbnails<T extends PublicProduct>(product: T) {
  const parameters = new URLSearchParams({ thumbnailVersion: '2' })
  if (product.updatedAt instanceof Date) parameters.set('v', product.updatedAt.getTime().toString())
  const thumbnailUrl = `/api/products/${product.id}/thumbnail?${parameters.toString()}`
  return {
    ...product,
    mainImage: thumbnailUrl,
    variants: product.variants
      ? JSON.stringify(parseVariants(product.variants).map((variant) => ({
          ...variant,
          image: variant.image
            ? `${thumbnailUrl}&variant=${encodeURIComponent(variant.id)}`
            : null,
        })))
      : product.variants,
  }
}
