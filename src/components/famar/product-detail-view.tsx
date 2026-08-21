'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { useCartStore } from '@/stores/cart-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { formatPrice } from '@/lib/utils'
import { ProductGallery } from './product-gallery'
import { ProductCard, type ProductData } from './product-card'
import { ShareButtons, getProductUrl } from './share-buttons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { useState, useEffect } from 'react'

export function ProductDetailView() {
  const { selectedProductId, navigate, selectProduct } = useAppStore()
  const addItem = useCartStore((s) => s.addItem)
  const { toggleFavorite, isFavorite, addViewed, viewedProducts } = useFavoritesStore()
  const [quantity, setQuantity] = useState(1)
  const favorite = selectedProductId ? isFavorite(selectedProductId) : false

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

  const { data: relatedProducts } = useQuery({
    queryKey: ['products', 'related', product?.category?.slug],
    queryFn: async () => {
      if (!product?.category?.slug) return []
      const params = new URLSearchParams({
        category: product.category.slug,
        limit: '8',
      })
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      return (data.products as ProductData[]).filter(
        (p) => p.id !== selectedProductId
      )
    },
    enabled: !!product?.category?.slug,
  })

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

  const isOutOfStock = product.status === 'out_of_stock'
  const tags: string[] = []
  if (product.isNew) tags.push('Nuevo')
  if (product.isOnSale) tags.push('Oferta')

  const handleAddToCart = () => {
    if (isOutOfStock) return
    addItem({
      productId: product.id,
      code: product.code,
      name: product.name,
      price: product.price,
      mainImage: product.mainImage || '',
      maxStock: product.stock,
    })
    // Add quantity times
    const currentItems = useCartStore.getState().items
    const existing = currentItems.find(i => i.productId === product.id)
    if (existing && existing.quantity < quantity) {
      useCartStore.getState().updateQuantity(product.id, quantity)
    }
    toast.success(`${product.name} agregado al carrito`)
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
          mainImage={product.mainImage}
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
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">Código: {product.code}</p>
          <p className="text-3xl font-bold text-primary">
            {formatPrice(product.price)}
          </p>

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
                {product.stock > 5 ? (
                  <>En stock</>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    ¡Últimas {product.stock} unidades!
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
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
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

          {/* Share */}
          <ShareButtons
            productName={product.name}
            productCode={product.code}
            productPrice={product.price}
            productUrl={getProductUrl(product.code)}
          />
        </motion.div>
      </div>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Productos Recomendados</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map((p, i) => (
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