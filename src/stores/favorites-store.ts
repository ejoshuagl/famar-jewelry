import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesStore {
  ids: string[]
  viewedProducts: string[]
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  addViewed: (id: string) => void
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      ids: [],
      viewedProducts: [],
      toggleFavorite: (id) => {
        const ids = get().ids
        if (ids.includes(id)) {
          set({ ids: ids.filter((i) => i !== id) })
        } else {
          set({ ids: [...ids, id] })
        }
      },
      isFavorite: (id) => {
        return get().ids.includes(id)
      },
      addViewed: (id) => {
        const viewed = get().viewedProducts.filter((v) => v !== id)
        set({ viewedProducts: [id, ...viewed].slice(0, 10) })
      },
    }),
    {
      name: 'famar-favorites',
    }
  )
)