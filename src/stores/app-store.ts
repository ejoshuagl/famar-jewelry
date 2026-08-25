import { create } from 'zustand'

export type AppView =
  | 'home'
  | 'catalog'
  | 'product-detail'
  | 'cart'
  | 'out-of-stock'
  | 'contact'
  | 'jewelry-care'
  | 'favorites'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-products'
  | 'admin-orders'
  | 'admin-categories'
  | 'admin-campaigns'
  | 'admin-themes'
  | 'admin-wholesale'
  | 'admin-coupons'

interface AppStore {
  currentView: AppView
  selectedProductId: string | null
  selectedProductCode: string | null
  selectedCategory: string | null
  catalogFilter: string | null
  catalogPage: number
  catalogSort: string
  catalogScrollY: number
  campaignFilter: { id: string; title: string } | null
  searchQuery: string
  sidebarOpen: boolean
  navigate: (view: AppView, pushHistory?: boolean) => void
  selectProduct: (id: string | null, code?: string | null) => void
  setCategory: (slug: string | null) => void
  setCatalogFilter: (filter: string | null) => void
  setCatalogPage: (page: number) => void
  setCatalogSort: (sort: string) => void
  setCampaignFilter: (campaign: { id: string; title: string } | null) => void
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
  selectedProductCode: null,
  selectedCategory: null,
  catalogFilter: null,
  catalogPage: 1,
  catalogSort: 'relevance',
  catalogScrollY: 0,
  campaignFilter: null,
  searchQuery: '',
  sidebarOpen: false,
  navigate: (view, pushHistory = true) => {
    const prevView = get().currentView
    if (prevView === 'catalog' && view !== 'catalog') {
      set({ catalogScrollY: window.scrollY })
    }

    // Keep catalog state so returning from a product restores the same results and page.
    set({ currentView: view, sidebarOpen: false })
    const restoreCatalogPosition = view === 'catalog' && prevView === 'product-detail'
    window.scrollTo({ top: restoreCatalogPosition ? get().catalogScrollY : 0, behavior: restoreCatalogPosition ? 'auto' : 'smooth' })

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

    // Build URL: include ?p=CODE when viewing a product
    const code = get().selectedProductCode
    const search = view === 'product-detail' && code ? `?p=${code}` : ''
    const hash = `#/${view}`

    // Push browser history entry
    const state = { view, index: historyIndex }
    window.history.pushState(state, '', `${window.location.pathname}${search}${hash}`)

    // Reset the skipPopState flag after a tick so the pushState event doesn't trigger popState handler
    requestAnimationFrame(() => {
      skipPopState = false
    })
  },
  selectProduct: (id, code = null) => set({ selectedProductId: id, selectedProductCode: code }),
  setCategory: (slug) => set({ selectedCategory: slug, catalogPage: 1 }),
  setCatalogFilter: (filter) => set({ catalogFilter: filter, catalogPage: 1 }),
  setCatalogPage: (page) => set({ catalogPage: Math.max(1, page) }),
  setCatalogSort: (sort) => set({ catalogSort: sort, catalogPage: 1 }),
  setCampaignFilter: (campaign) => set({ campaignFilter: campaign, catalogPage: 1 }),
  setSearch: (q) => set({ searchQuery: q, catalogPage: 1 }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// Initialize browser history on first load
if (typeof window !== 'undefined') {
  const validViews: AppView[] = [
    'home', 'catalog', 'product-detail', 'cart', 'out-of-stock', 'contact', 'jewelry-care',
    'favorites', 'admin-login', 'admin-dashboard', 'admin-products',
    'admin-orders', 'admin-categories', 'admin-campaigns', 'admin-themes', 'admin-wholesale', 'admin-coupons',
  ]

  // Restore the view from the URL hash so a reload keeps the user where they were
  const restoreViewFromHash = (): AppView | null => {
    const match = window.location.hash.match(/^#\/([a-z-]+)/)
    if (!match) return null
    return validViews.includes(match[1] as AppView) ? (match[1] as AppView) : null
  }

  const sharedProductCode = new URLSearchParams(window.location.search).get('p')
  const initialView = restoreViewFromHash() || (sharedProductCode ? 'product-detail' : null)
  if (initialView) {
    useAppStore.setState({ currentView: initialView })
    historyStack = [initialView]
    window.history.replaceState({ view: initialView, index: 0 }, '', `${window.location.pathname}${window.location.search}${window.location.hash}`)
  } else {
    window.history.replaceState({ view: 'home', index: 0 }, '', '#/home')
  }

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (event) => {
    if (skipPopState) return

    const state = event.state as { view: AppView; index: number } | null
    if (state && typeof state.view === 'string') {
      historyIndex = state.index
      const restoreCatalogPosition = state.view === 'catalog'
      // Update Zustand state without pushing new history
      skipPopState = true
      useAppStore.setState({ currentView: state.view, sidebarOpen: false })
      requestAnimationFrame(() => {
        window.scrollTo({ top: restoreCatalogPosition ? useAppStore.getState().catalogScrollY : 0, behavior: 'auto' })
        skipPopState = false
      })
    } else {
      // Fallback: use the URL hash if valid, otherwise go to home
      const fromHash = restoreViewFromHash()
      const view = fromHash ?? 'home'
      historyIndex = 0
      historyStack = [view]
      skipPopState = true
      useAppStore.setState({ currentView: view, sidebarOpen: false })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      requestAnimationFrame(() => {
        skipPopState = false
      })
    }
  })
}
