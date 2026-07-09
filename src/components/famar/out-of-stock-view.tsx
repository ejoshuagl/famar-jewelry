'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonGrid } from './skeleton-grid'
import { EmptyState } from './empty-state'
import { formatPrice, convertDriveUrl } from '@/lib/utils'
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
    const message = `🔔 *SOLICITUD DE IMPORTACIÓN - FAMAR*
────────────────
Me interesa el producto:
📌 *${product.name}* (Código: ${product.code})
💲 *Precio:* ${formatPrice(product.price)}
Me gustaría que lo incluyan en la próxima importación.
¡Gracias! 🙏`
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/593000000000?text=${encoded}`, '_blank')
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
              >
                <Card className="overflow-hidden">
                  <div className="relative">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="aspect-square w-full object-cover opacity-60"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-5xl font-bold text-primary/30">
                          {product.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Badge variant="secondary" className="text-sm">
                        Agotado
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.code}</p>
                    <p className="text-sm font-bold text-primary">{formatPrice(product.price)}</p>
                    {product.material && (
                      <p className="text-xs text-muted-foreground">Material: {product.material}</p>
                    )}
                    {product.dimensions && (
                      <p className="text-xs text-muted-foreground">Dimensiones: {product.dimensions}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => handleRequestImport(product)}
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Solicitar importación
                    </Button>
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