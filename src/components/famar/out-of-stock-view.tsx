'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonGrid } from './skeleton-grid'
import { EmptyState } from './empty-state'
import { formatPrice, convertDriveUrl, cn } from '@/lib/utils'
import { Bell } from 'lucide-react'
import type { ProductData } from './product-card'

export function OutOfStockView() {
  const { data, isLoading } = useQuery({
    queryKey: ['products', 'out-of-stock'],
    queryFn: async () => {
      const res = await fetch('/api/products?status=out_of_stock&limit=100')
      const data = await res.json()
      return data.products as ProductData[]
    },
  })

  const handleRequestImport = (product: ProductData) => {
    const message = `*SOLICITUD DE IMPORTACION - FAMAR*
-------------------
Me interesa el producto:
*${product.name}* (Codigo: ${product.code})
*Precio:* ${formatPrice(product.price)}
Me gustaria que lo incluyan en la proxima importacion.
Gracias!`
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/593988215076?text=${encoded}`, '_blank')
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Productos Agotados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Productos actualmente fuera de stock. Solicita su próxima importación.
        </p>
      </div>

      {isLoading ? (
        <SkeletonGrid count={8} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No hay productos agotados"
          description="¡Buenas noticias! Todos nuestros productos están disponibles."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((product, i) => {
            const imageUrl = product.mainImage ? convertDriveUrl(product.mainImage) : null
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="h-full"
              >
                <Card className="h-full flex flex-col overflow-hidden">
                  <div className="relative aspect-square shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover opacity-60"
                        loading="lazy"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                          ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      !imageUrl && 'aspect-square',
                      'w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5',
                      imageUrl && 'hidden absolute inset-0'
                    )}>
                      <span className="text-5xl font-bold text-primary/30">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Badge variant="secondary" className="text-sm">
                        Agotado
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 flex flex-col flex-1 min-h-0">
                    <h3 className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <span className="text-base font-bold text-primary leading-none">
                        {formatPrice(product.price)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => handleRequestImport(product)}
                      >
                        <Bell className="h-3 w-3 mr-1" />
                        Solicitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}