'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { useCartStore } from '@/stores/cart-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { formatPrice } from '@/lib/utils'
import { ProductGallery } from './product-gallery'
import { ProductCard, type ProductData, flyToCartFrom } from './product-card'
import { ShareButtons, getProductUrl } from './share-buttons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  Heart,
  Minus,
  Plus,
  Package,
  Ruler,
  Weight,
  Palette,
  ChevronRight,
  Bell,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { parseVariants } from '@/lib/product-variants'
import { salePrice } from '@/lib/pricing'
import { usePricingSettings } from '@/hooks/use-pricing-settings'
import { trackStoreEvent } from '@/lib/track-store-event'

export function ProductDetailView() {
  const { selectedProductId, navigate, selectProduct } = useAppStore()
  const addItem = useCartStore((s) => s.addItem)
  const { toggleFavorite, isFavorite, addViewed, viewedProducts } = useFavoritesStore()
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const favorite = selectedProductId ? isFavorite(selectedProductId) : false
  const { saleDiscount } = usePricingSettings()
  const campaignId = useAppStore((state) => state.campaignFilter?.id)

  useEffect(() => {
    if (selectedProductId) {
      addViewed(selectedProductId)
    }
  }, [selectedProductId, addViewed])

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return null
      const res = await fetch(`/api/products/${selectedProductId}`)
      if (!res.ok) return null
      return res.json() as Promise<ProductData>
    },
    enabled: !!selectedProductId,
  })

  const { data: relatedProducts, isLoading: loadingRelated } = useQuery({
    queryKey: ['products', 'recommendations', product?.id],
    queryFn: async () => {
      if (!product?.id) return []
      const res = await fetch(`/api/products/${product.id}/recommendations?limit=8`)
      if (!res.ok) return []
      const data = await res.json()
      return data.products as ProductData[]
    },
    enabled: !!product?.id,
  })

  useEffect(() => {
    if (product?.id) trackStoreEvent('product_view', { productId: product.id, campaignId })
  }, [campaignId, product?.id])

  const { data: viewedProductsData } = useQuery({
    queryKey: ['products', 'viewed', viewedProducts],
    queryFn: async () => {
      if (!viewedProducts || viewedProducts.length === 0) return []
      const products: ProductData[] = []
      for (const id of viewedProducts.slice(0, 4)) {
        if (id === selectedProductId) continue
        try {
          const res = await fetch(`/api/products/${id}`)
          if (res.ok) products.push(await res.json())
        } catch {
          // skip
        }
      }
      return products
    },
    enabled: viewedProducts.length > 0,
  })

  const variants = parseVariants(product?.variants)
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || variants[0]
  const availableStock = selectedVariant ? selectedVariant.stock : product?.stock || 0

  if (!selectedProductId) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Producto no seleccionado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('catalog')}>
          Ver catálogo
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Producto no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('catalog')}>
          Volver al catálogo
        </Button>
      </div>
    )
  }

  const isOutOfStock = product.status === 'out_of_stock' || availableStock <= 0
  const currentPrice = salePrice(product.price, Boolean(product.isOnSale), saleDiscount)
  const tags: string[] = []
  if (product.isNew) tags.push('Nuevo')
  if (product.isOnSale) tags.push('Oferta')

  const handleAddToCart = () => {
    if (isOutOfStock) return
    flyToCartFrom(document.querySelector('main img'))
    addItem({
      productId: product.id,
      itemKey: selectedVariant ? `${product.id}:${selectedVariant.id}` : product.id,
      code: product.code,
      name: product.name,
      price: product.price,
      isOnSale: Boolean(product.isOnSale),
      mainImage: selectedVariant?.image || product.mainImage || '',
      maxStock: availableStock,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
    })
    // Add quantity times
    const currentItems = useCartStore.getState().items
    const itemKey = selectedVariant ? `${product.id}:${selectedVariant.id}` : product.id
    const existing = currentItems.find(i => (i.itemKey || i.productId) === itemKey)
    if (existing && existing.quantity < quantity) {
      useCartStore.getState().updateQuantity(itemKey, quantity)
    }
    toast.success(`${product.name} agregado al carrito`)
    trackStoreEvent('add_to_cart', { productId: product.id, campaignId })
  }

  const handleRequestImport = () => {
    const message = `*SOLICITUD DE IMPORTACION - FAMAR*\n-------------------\nMe interesa el producto:\n*${product.name}* (Codigo: ${product.code})\n*Precio:* ${formatPrice(currentPrice)}\nMe gustaria que lo incluyan en la proxima importacion.\nGracias!`
    window.open(`https://wa.me/593988215076?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('home')} className="hover:text-foreground transition-colors">
          Inicio
        </button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate('catalog')} className="hover:text-foreground transition-colors">
          Catálogo
        </button>
        {product.category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => {
                useAppStore.getState().setCategory(product.category!.slug)
                navigate('catalog')
              }}
              className="hover:text-foreground transition-colors"
            >
              {product.category.name}
            </button>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {product.name}
        </span>
      </nav>

      {/* Product detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <ProductGallery
          mainImage={selectedVariant?.image || product.mainImage}
          images={product.images}
          productName={product.name}
        />

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant={tag === 'Nuevo' ? 'default' : tag === 'Oferta' ? 'destructive' : 'outline'}>
                  {tag === 'Oferta' ? `Oferta -${saleDiscount}%` : tag}
                </Badge>
              ))}
            </div>
          )}

          <h1 className="allow-text-selection text-2xl sm:text-3xl font-bold">{product.name}</h1>
          <p className="allow-text-selection text-sm text-muted-foreground">Código: {product.code}</p>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-primary">{formatPrice(currentPrice)}</p>
            {product.isOnSale && <p className="text-base text-muted-foreground line-through">{formatPrice(product.price)}</p>}
          </div>

          {product.category && (
            <p className="text-sm">
              Categoría:{' '}
              <button
                onClick={() => {
                  useAppStore.getState().setCategory(product.category!.slug)
                  navigate('catalog')
                }}
                className="text-primary hover:underline"
              >
                {product.category.name}
              </button>
            </p>
          )}

          <Separator />

          {variants.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color: {selectedVariant?.name}</Label>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    onClick={() => { setSelectedVariantId(variant.id); setQuantity(1) }}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-sm transition-colors ${selectedVariant?.id === variant.id ? 'border-primary bg-primary/10' : 'hover:border-primary/60'} ${variant.stock <= 0 ? 'opacity-50' : ''}`}
                  >
                    {variant.image && <img src={variant.image} alt="" className="h-10 w-10 rounded-md object-cover" />}
                    <span>{variant.name}</span>
                    {variant.stock <= 0 && <span className="text-xs text-destructive">Agotado</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {product.material && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium">{product.material}</span>
              </div>
            )}
            {product.weight && (
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Peso:</span>
                <span className="font-medium">{product.weight}</span>
              </div>
            )}
            {product.dimensions && (
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Dimensiones:</span>
                <span className="font-medium">{product.dimensions}</span>
              </div>
            )}
            {product.color && (
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Color:</span>
                <span className="font-medium">{product.color}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Stock status */}
          <div>
            {isOutOfStock ? (
              <p className="text-sm font-medium text-destructive">Agotado</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {availableStock > 5 ? (
                  <>En stock</>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    {availableStock === 1
                      ? '¡Última unidad!'
                      : `¡Últimas ${availableStock} unidades!`}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Add to cart */}
          {!isOutOfStock && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Agregar al carrito
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => {
                  toggleFavorite(product.id)
                  toast.success(favorite ? 'Eliminado de favoritos' : 'Agregado a favoritos')
                }}
              >
                <Heart className={`h-4 w-4 ${favorite ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
            </div>
          )}

          {isOutOfStock && (
            <Button
              size="lg"
              variant="outline"
              className="w-full border-primary/50 text-primary hover:bg-primary/10"
              onClick={handleRequestImport}
            >
              <Bell className="mr-2 h-4 w-4" />
              Solicitar este producto
            </Button>
          )}

          {!isOutOfStock && <p className="text-center text-xs text-muted-foreground">Envíos desde Babahoyo a todo Ecuador · Confirmación por WhatsApp</p>}

          {/* Share */}
          <ShareButtons
            productName={product.name}
            productCode={product.code}
            productPrice={currentPrice}
            productUrl={getProductUrl(product.code)}
          />
        </motion.div>
      </div>

      {/* Smart cross-category recommendations */}
      {(loadingRelated || (relatedProducts && relatedProducts.length > 0)) && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Completa tu look</h2>
            <p className="text-sm text-muted-foreground">
              Piezas de distintas categorías elegidas para combinar con este producto.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingRelated
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Skeleton className="aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              : relatedProducts?.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
          </div>
        </section>
      )}

      {/* Recently Viewed */}
      {viewedProductsData && viewedProductsData.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Vistos Recientemente</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {viewedProductsData.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
