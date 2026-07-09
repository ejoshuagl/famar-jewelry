'use client'

import { useQuery } from '@tanstack/react-query'
import { useFavoritesStore } from '@/stores/favorites-store'
import { useAppStore } from '@/stores/app-store'
import { ProductCard, type ProductData } from './product-card'
import { EmptyState } from './empty-state'
import { SkeletonGrid } from './skeleton-grid'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FavoritesView() {
  const { ids } = useFavoritesStore()
  const navigate = useAppStore((s) => s.navigate)

  const { data: products, isLoading } = useQuery({
    queryKey: ['favorites', ids],
    queryFn: async () => {
      if (ids.length === 0) return []
      const results: ProductData[] = []
      for (const id of ids) {
        try {
          const res = await fetch(`/api/products/${id}`)
          if (res.ok) results.push(await res.json())
        } catch {
          // skip
        }
      }
      return results
    },
    enabled: ids.length > 0,
  })

  if (ids.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EmptyState
          icon={<Heart className="h-16 w-16" />}
          title="No tienes favoritos"
          description="Agrega productos a tus favoritos para encontrarlos fácilmente."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('catalog')}
            >
              Ver catálogo
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500" />
          Mis Favoritos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ids.length} producto{ids.length !== 1 ? 's' : ''} guardado{ids.length !== 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <SkeletonGrid count={4} />
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No se encontraron productos"
          description="Algunos de tus favoritos pueden haber sido eliminados."
          action={
            <Button
              variant="outline"
              onClick={() => navigate('catalog')}
            >
              Ver catálogo
            </Button>
          }
        />
      )}
    </div>
  )
}