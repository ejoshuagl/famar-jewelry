import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  productId: string
  code: string
  name: string
  price: number
  quantity: number
  mainImage: string
  maxStock: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
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
      addItem: (item) => {
        const items = get().items
        const existing = items.find((i) => i.productId === item.productId)
        if (existing) {
          const newQty = Math.min(existing.quantity + 1, item.maxStock)
          if (newQty === existing.quantity) return
          set({
            items: items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: newQty } : i
            ),
          })
        } else {
          set({ items: [...items, { ...item, quantity: 1 }] })
        }
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) })
      },
      updateQuantity: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: Math.min(qty, i.maxStock) }
              : i
          ),
        })
      },
      clearCart: () => set({ items: [] }),
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