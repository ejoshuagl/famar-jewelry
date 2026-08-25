import { create } from 'zustand'

export type AppView =
  | 'home' | 'catalog' | 'product-detail' | 'cart' | 'out-of-stock' | 'contact'
  | 'jewelry-care' | 'favorites' | 'admin-login' | 'admin-dashboard' | 'admin-products'
  | 'admin-orders' | 'admin-categories' | 'admin-campaigns' | 'admin-themes'
  | 'admin-wholesale' | 'admin-coupons'

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

const viewPaths: Record<Exclude<AppView, 'product-detail'>, string> = {
  home: '/', catalog: '/catalogo', cart: '/carrito', 'out-of-stock': '/agotados',
  contact: '/contacto', 'jewelry-care': '/cuidados', favorites: '/favoritos',
  'admin-login': '/admin', 'admin-dashboard': '/admin/dashboard',
  'admin-products': '/admin/productos', 'admin-orders': '/admin/pedidos',
  'admin-categories': '/admin/categorias', 'admin-campaigns': '/admin/campanas',
  'admin-themes': '/admin/temas', 'admin-wholesale': '/admin/mayoristas',
  'admin-coupons': '/admin/cupones',
}

type CatalogState = Pick<AppStore,
  'selectedCategory' | 'catalogFilter' | 'catalogPage' | 'catalogSort' | 'campaignFilter' | 'searchQuery'
>

function catalogQuery(state: CatalogState) {
  const params = new URLSearchParams()
  if (state.searchQuery) params.set('q', state.searchQuery)
  if (state.selectedCategory) params.set('categoria', state.selectedCategory)
  if (state.catalogFilter) params.set('filtro', state.catalogFilter)
  if (state.campaignFilter) {
    params.set('campana', state.campaignFilter.id)
    if (state.campaignFilter.title) params.set('titulo', state.campaignFilter.title)
  }
  if (state.catalogPage > 1) params.set('pagina', String(state.catalogPage))
  if (state.catalogSort !== 'relevance') params.set('orden', state.catalogSort)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function pathForView(view: AppView, state: AppStore) {
  if (view === 'product-detail') {
    return state.selectedProductCode
      ? `/producto/${encodeURIComponent(state.selectedProductCode)}`
      : '/catalogo'
  }
  const path = viewPaths[view]
  return view === 'catalog' ? `${path}${catalogQuery(state)}` : path
}

function parseLocation(): Partial<AppStore> & { currentView: AppView } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  if (path.startsWith('/producto/')) {
    const code = decodeURIComponent(path.slice('/producto/'.length))
    return { currentView: 'product-detail', selectedProductCode: code || null, selectedProductId: null }
  }

  const matched = Object.entries(viewPaths).find(([, route]) => route === path)
  const currentView = (matched?.[0] as AppView | undefined) ?? 'home'
  if (currentView !== 'catalog') return { currentView, selectedProductCode: null }

  const parsedPage = Number.parseInt(params.get('pagina') || '1', 10)
  const campaignId = params.get('campana')
  return {
    currentView,
    selectedCategory: params.get('categoria'),
    catalogFilter: params.get('filtro'),
    catalogPage: Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1,
    catalogSort: params.get('orden') || 'relevance',
    campaignFilter: campaignId ? { id: campaignId, title: params.get('titulo') || 'Campaña' } : null,
    searchQuery: params.get('q') || '',
    selectedProductCode: null,
  }
}

export function restoreAppFromLocation() {
  if (typeof window === 'undefined') return
  const locationState = parseLocation()
  const current = useAppStore.getState()
  if (
    locationState.currentView === 'product-detail'
    && locationState.selectedProductCode === current.selectedProductCode
    && current.selectedProductId
  ) {
    locationState.selectedProductId = current.selectedProductId
  }
  useAppStore.setState(locationState)
}

function syncCatalogUrl(state: AppStore) {
  if (typeof window === 'undefined' || state.currentView !== 'catalog') return
  window.history.replaceState({ view: 'catalog' }, '', pathForView('catalog', state))
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentView: 'home', selectedProductId: null, selectedProductCode: null,
  selectedCategory: null, catalogFilter: null, catalogPage: 1,
  catalogSort: 'relevance', catalogScrollY: 0, campaignFilter: null,
  searchQuery: '', sidebarOpen: false,
  navigate: (view, pushHistory = true) => {
    const prevView = get().currentView
    if (prevView === 'catalog' && view !== 'catalog') set({ catalogScrollY: window.scrollY })
    set({ currentView: view, sidebarOpen: false })
    const restoreCatalogPosition = view === 'catalog' && prevView === 'product-detail'
    window.scrollTo({ top: restoreCatalogPosition ? get().catalogScrollY : 0, behavior: restoreCatalogPosition ? 'auto' : 'smooth' })
    if (pushHistory) window.history.pushState({ view }, '', pathForView(view, get()))
  },
  selectProduct: (id, code = null) => set({ selectedProductId: id, selectedProductCode: code }),
  setCategory: (slug) => { set({ selectedCategory: slug, catalogPage: 1 }); syncCatalogUrl(get()) },
  setCatalogFilter: (filter) => { set({ catalogFilter: filter, catalogPage: 1 }); syncCatalogUrl(get()) },
  setCatalogPage: (page) => { set({ catalogPage: Math.max(1, page) }); syncCatalogUrl(get()) },
  setCatalogSort: (sort) => { set({ catalogSort: sort, catalogPage: 1 }); syncCatalogUrl(get()) },
  setCampaignFilter: (campaign) => { set({ campaignFilter: campaign, catalogPage: 1 }); syncCatalogUrl(get()) },
  setSearch: (q) => { set({ searchQuery: q, catalogPage: 1 }); syncCatalogUrl(get()) },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

if (typeof window !== 'undefined') {
  const legacyMatch = window.location.hash.match(/^#\/([a-z-]+)/)
  const legacyCode = new URLSearchParams(window.location.search).get('p')
  if (legacyMatch || legacyCode) {
    const legacyView = legacyMatch?.[1] as AppView | undefined
    const validLegacyView = legacyView && (legacyView === 'product-detail' || legacyView in viewPaths)
      ? legacyView : legacyCode ? 'product-detail' : 'home'
    useAppStore.setState({ currentView: validLegacyView, selectedProductCode: legacyCode, selectedProductId: null })
    window.history.replaceState({ view: validLegacyView }, '', pathForView(validLegacyView, useAppStore.getState()))
  } else {
    useAppStore.setState(parseLocation())
    window.history.replaceState({ view: useAppStore.getState().currentView }, '', window.location.href)
  }

  window.addEventListener('popstate', () => {
    const previousView = useAppStore.getState().currentView
    const locationState = parseLocation()
    useAppStore.setState({ ...locationState, sidebarOpen: false })
    const restoreCatalogPosition = locationState.currentView === 'catalog' && previousView === 'product-detail'
    requestAnimationFrame(() => window.scrollTo({
      top: restoreCatalogPosition ? useAppStore.getState().catalogScrollY : 0,
      behavior: 'auto',
    }))
  })
}
