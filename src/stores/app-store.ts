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
  navigate: (view: AppView, pushHistory?: boolean) => void
  selectProduct: (id: string | null) => void
  setCategory: (slug: string | null) => void
  setSearch: (q: string) => void
  setSidebarOpen: (open: boolean) => void
}

// Navigation history stack for browser back/forward support
let historyStack: AppView[] = ['home']
let historyIndex = 0
let skipPopState = false

export const useAppStore = create<AppStore>((set, get) => ({
  currentView: 'home',
  selectedProductId: null,
  selectedCategory: null,
  searchQuery: '',
  sidebarOpen: false,
  navigate: (view, pushHistory = true) => {
    const prevView = get().currentView

    // Update Zustand state
    set({ currentView: view, sidebarOpen: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // Manage browser history
    if (!pushHistory) return

    skipPopState = true

    // If we went back and then navigate forward, trim the forward history
    if (historyIndex < historyStack.length - 1) {
      historyStack = historyStack.slice(0, historyIndex + 1)
    }

    // Don't push duplicate entries
    if (historyStack[historyStack.length - 1] !== view) {
      historyStack.push(view)
      historyIndex = historyStack.length - 1
    }

    // Push browser history entry
    const state = { view, index: historyIndex }
    window.history.pushState(state, '', `#/${view}`)

    // Reset the skipPopState flag after a tick so the pushState event doesn't trigger popState handler
    requestAnimationFrame(() => {
      skipPopState = false
    })
  },
  selectProduct: (id) => set({ selectedProductId: id }),
  setCategory: (slug) => set({ selectedCategory: slug }),
  setSearch: (q) => set({ searchQuery: q }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// Initialize browser history on first load
if (typeof window !== 'undefined') {
  // Set initial history state
  window.history.replaceState({ view: 'home', index: 0 }, '', '#/home')

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (event) => {
    if (skipPopState) return

    const state = event.state as { view: AppView; index: number } | null
    if (state && typeof state.view === 'string') {
      historyIndex = state.index
      // Update Zustand state without pushing new history
      skipPopState = true
      useAppStore.setState({ currentView: state.view, sidebarOpen: false })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      requestAnimationFrame(() => {
        skipPopState = false
      })
    } else {
      // Fallback: go to home
      historyIndex = 0
      historyStack = ['home']
      skipPopState = true
      useAppStore.setState({ currentView: 'home', sidebarOpen: false })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      requestAnimationFrame(() => {
        skipPopState = false
      })
    }
  })
}