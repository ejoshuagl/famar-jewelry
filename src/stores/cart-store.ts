import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  itemKey?: string
  productId: string
  code: string
  name: string
  price: number
  isOnSale?: boolean
  unavailable?: boolean
  quantity: number
  mainImage: string
  maxStock: number
  variantId?: string
  variantName?: string
}

interface CartStore {
  items: CartItem[]
  lastUpdatedAt: number
  replaceItems: (items: CartItem[]) => void
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      lastUpdatedAt: 0,
      replaceItems: (items) => set({ items }),
      addItem: (item) => {
        const items = get().items
        const itemKey = item.itemKey || item.productId
        const existing = items.find((i) => (i.itemKey || i.productId) === itemKey)
        if (existing) {
          const newQty = Math.min(existing.quantity + 1, item.maxStock)
          if (newQty === existing.quantity) return
          set({
            items: items.map((i) =>
              (i.itemKey || i.productId) === itemKey ? { ...i, quantity: newQty } : i
            ),
            lastUpdatedAt: Date.now(),
          })
        } else {
          set({ items: [...items, { ...item, itemKey, quantity: 1 }], lastUpdatedAt: Date.now() })
        }
      },
      removeItem: (itemKey) => {
        set({ items: get().items.filter((i) => (i.itemKey || i.productId) !== itemKey), lastUpdatedAt: Date.now() })
      },
      updateQuantity: (itemKey, qty) => {
        if (qty <= 0) {
          get().removeItem(itemKey)
          return
        }
        set({
          items: get().items.map((i) =>
            (i.itemKey || i.productId) === itemKey
              ? { ...i, quantity: Math.min(qty, i.maxStock) }
              : i
          ),
          lastUpdatedAt: Date.now(),
        })
      },
      clearCart: () => set({ items: [], lastUpdatedAt: 0 }),
      getTotal: () => {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },
      getItemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    {
      name: 'famar-cart',
    }
  )
)
