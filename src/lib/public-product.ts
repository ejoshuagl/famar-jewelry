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
  const publicImageBySource = new Map<string, string>()
  if (product.mainImage) publicImageBySource.set(product.mainImage, thumbnailUrl)
  const publicVariants = parseVariants(product.variants).map((variant) => {
    if (!variant.image) return { ...variant, image: null }

    const existingImage = publicImageBySource.get(variant.image)
    if (existingImage) return { ...variant, image: existingImage }

    const variantImage = `${thumbnailUrl}&variant=${encodeURIComponent(variant.id)}`
    publicImageBySource.set(variant.image, variantImage)
    return { ...variant, image: variantImage }
  })

  return {
    ...product,
    mainImage: thumbnailUrl,
    variants: product.variants
      ? JSON.stringify(publicVariants)
      : product.variants,
  }
}
