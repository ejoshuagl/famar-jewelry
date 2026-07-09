import { create } from 'zustand'

export type AppView =
  | 'home'
  | 'catalog'
  | 'product-detail'
  | 'cart'
  | 'out-of-stock'
  | 'contact'
  | 'favorites'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-products'
  | 'admin-orders'
  | 'admin-categories'

interface AppStore {
  currentView: AppView
  selectedProductId: string | null
  selectedCategory: string | null
  searchQuery: string
  sidebarOpen: boolean
  navigate: (view: AppStore) => void
  selectProduct: (id: string | null) => void
  setCategory: (slug: string | null) => void
  setSearch: (q: string) => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  selectedProductId: null,
  selectedCategory: null,
  searchQuery: '',
  sidebarOpen: false,
  navigate: (view) => {
    set({ currentView: view, sidebarOpen: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
  selectProduct: (id) => set({ selectedProductId: id }),
  setCategory: (slug) => set({ selectedCategory: slug }),
  setSearch: (q) => set({ searchQuery: q }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))