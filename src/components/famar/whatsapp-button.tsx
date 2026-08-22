'use client'

import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/stores/cart-store'
import { useAppStore } from '@/stores/app-store'
import { Badge } from '@/components/ui/badge'

export function WhatsAppButton() {
  const itemCount = useCartStore((s) => s.getItemCount())
  const navigate = useAppStore((s) => s.navigate)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <motion.button
      onClick={() => navigate('cart')}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Ir al carrito de compras"
      data-cart-button
    >
      <ShoppingCart className="h-7 w-7" />
      {mounted && itemCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[11px] font-bold border-2 border-background bg-destructive text-destructive-foreground">
          {itemCount > 99 ? '99+' : itemCount}
        </Badge>
      )}
    </motion.button>
  )
}