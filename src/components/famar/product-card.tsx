'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heart, ShoppingCart, Eye, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useCartStore, type CartItem } from '@/stores/cart-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { formatPrice, convertDriveUrl, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProductVariant } from '@/lib/product-variants'
import { parseVariants } from '@/lib/product-variants'


export interface ProductData {
  id: string
  code: string
  name: string
  description?: string | null
  price: number
  stock: number
  status: string
  mainImage?: string | null
  category?: { name: string; slug: string } | null
  isFeatured?: boolean
  isNew?: boolean
  isOnSale?: boolean
  material?: string | null
  images?: string | null
  variants?: string | ProductVariant[] | null
}

interface ProductCardProps {
  product: ProductData
  index?: number
}

// Animación: una copia circular de la imagen vuela hasta el botón del carrito
export function flyToCartFrom(source: Element | null) {
  const target = document.querySelector('[data-cart-button]')
  if (!source || !target) return

  const from = (source as HTMLElement).getBoundingClientRect()
  const to = target.getBoundingClientRect()
  const size = Math.min(from.width, 80)

  const ghost = document.createElement('div')
  const imgSrc = (source as HTMLImageElement).src || (source as HTMLImageElement).style?.backgroundImage
  if (typeof imgSrc === 'string' && imgSrc.startsWith('http')) {
    ghost.style.backgroundImage = `url(${imgSrc})`
    ghost.style.backgroundSize = 'cover'
  } else {
    ghost.style.background = 'linear-gradient(135deg, rgba(200,169,81,0.5), rgba(200,169,81,0.15))'
  }
  ghost.style.position = 'fixed'
  ghost.style.zIndex = '100'
  ghost.style.borderRadius = '9999px'
  ghost.style.pointerEvents = 'none'
  ghost.style.boxShadow = '0 8px 24px rgba(200,169,81,0.4)'
  ghost.style.width = `${size}px`
  ghost.style.height = `${size}px`
  ghost.style.left = `${from.left + from.width / 2 - size / 2}px`
  ghost.style.top = `${from.top + from.height / 2 - size / 2}px`
  document.body.appendChild(ghost)

  const deltaX = to.left + to.width / 2 - (from.left + from.width / 2)
  const deltaY = to.top + to.height / 2 - (from.top + from.height / 2)

  const anim = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${deltaX * 0.5}px, ${deltaY * 0.6 - 60}px) scale(0.7)`, opacity: 0.9, offset: 0.5 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.15)`, opacity: 0.4 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.5, -0.2, 0.6, 1)' }
  )
  anim.onfinish = () => {
    ghost.remove()
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }],
      { duration: 300, easing: 'ease-out' }
    )
  }
}

export function ProductPlaceholder({ letter }: { letter: string }) {
  return (
    <div className="aspect-square w-full rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/30 dark:via-primary/15 dark:to-primary/5 flex items-center justify-center">
      <span className="text-5xl font-bold text-primary/40">{letter}</span>
    </div>
  )
}

function getTags(product: ProductData): string[] {
  const tags: string[] = []
  if (product.isNew) tags.push('Nuevo')
  if (product.isOnSale) tags.push('Oferta')
  if (product.stock > 0 && product.stock <= 3 && product.status === 'available') tags.push('Últimas unidades')
  if (product.status === 'out_of_stock') tags.push('Agotado')
  return tags
}

function getTagVariant(tag: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (tag === 'Nuevo') return 'default'
  if (tag === 'Oferta') return 'destructive'
  if (tag === 'Últimas unidades') return 'outline'
  if (tag === 'Agotado') return 'secondary'
  return 'outline'
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { navigate, selectProduct } = useAppStore()
  const addItem = useCartStore((s) => s.addItem)
  const { toggleFavorite, isFavorite } = useFavoritesStore()
  const favorite = isFavorite(product.id)
  const tags = getTags(product)
  const isOutOfStock = product.status === 'out_of_stock'
  const imageUrl = product.mainImage ? convertDriveUrl(product.mainImage) : null
  const hasVariants = parseVariants(product.variants).length > 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isOutOfStock) return
    if (hasVariants) {
      selectProduct(product.id, product.code)
      navigate('product-detail')
      toast.info('Elige el color antes de agregarlo')
      return
    }
    flyToCartFrom((e.currentTarget as HTMLElement).closest('.group')?.querySelector('img'))
    addItem({
      productId: product.id,
      code: product.code,
      name: product.name,
      price: product.price,
      mainImage: product.mainImage || '',
      maxStock: product.stock,
    })
    toast.success(`${product.name} agregado al carrito`)
  }

  const handleRequestImport = (e: React.MouseEvent) => {
    e.stopPropagation()
    const message = `*SOLICITUD DE IMPORTACION - FAMAR*\n-------------------\nMe interesa el producto:\n*${product.name}* (Codigo: ${product.code})\n*Precio:* ${formatPrice(product.price)}\nMe gustaria que lo incluyan en la proxima importacion.\nGracias!`
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/593988215076?text=${encoded}`, '_blank')
  }

  const handleViewDetail = () => {
    selectProduct(product.id, product.code)
    navigate('product-detail')
  }

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(product.id)
    toast.success(favorite ? 'Eliminado de favoritos' : 'Agregado a favoritos')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card
        className="group h-full flex flex-col overflow-hidden cursor-pointer border hover:shadow-lg transition-all duration-300"
        onClick={handleViewDetail}
      >
        {/* Image - fixed aspect ratio, largest possible */}
        <div className="relative aspect-square shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
                ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={cn(!imageUrl && 'aspect-square', 'w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/30 dark:via-primary/15 dark:to-primary/5', imageUrl && 'hidden absolute inset-0')}>
            <span className="text-5xl font-bold text-primary/40">
              {product.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Tags */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant={getTagVariant(tag)} className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Actions overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 dark:bg-black/70 backdrop-blur-sm hover:bg-white dark:hover:bg-black/80 shadow-sm"
              onClick={handleToggleFavorite}
            >
              <Heart className={cn('h-3.5 w-3.5', favorite && 'fill-red-500 text-red-500')} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/90 dark:bg-black/70 backdrop-blur-sm hover:bg-white dark:hover:bg-black/80 shadow-sm"
              onClick={handleViewDetail}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>

          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Content - compact, fixed structure */}
        <CardContent className="p-3 flex flex-col flex-1 min-h-0">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
          <div className="mt-auto pt-2 flex items-end justify-between gap-2">
            <span className="text-base font-bold text-primary leading-none">
              {formatPrice(product.price)}
            </span>
            {isOutOfStock ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleRequestImport}
              >
                <Bell className="h-3 w-3 mr-1" />
                Solicitar
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 px-3 text-xs shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                {hasVariants ? 'Elegir color' : 'Agregar'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function ProductCardSkeleton() {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <Skeleton className="aspect-square w-full shrink-0" />
      <CardContent className="p-3 flex flex-col flex-1">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-auto pt-2 flex items-end justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}
