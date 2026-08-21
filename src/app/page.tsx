'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { SiteHeader } from '@/components/famar/site-header'
import { SiteFooter } from '@/components/famar/site-footer'
import { WhatsAppButton } from '@/components/famar/whatsapp-button'
import { ScrollToTop } from '@/components/famar/scroll-to-top'
import { HomeView } from '@/components/famar/home-view'
import { CatalogView } from '@/components/famar/catalog-view'
import { ProductDetailView } from '@/components/famar/product-detail-view'
import { CartView } from '@/components/famar/cart-view'
import { OutOfStockView } from '@/components/famar/out-of-stock-view'
import { ContactView } from '@/components/famar/contact-view'
import { FavoritesView } from '@/components/famar/favorites-view'
import { AdminLoginView } from '@/components/famar/admin-login-view'
import { AdminLayout } from '@/components/famar/admin-layout'
import { AdminDashboardView } from '@/components/famar/admin-dashboard-view'
import { AdminProductsView } from '@/components/famar/admin-products-view'
import { AdminOrdersView } from '@/components/famar/admin-orders-view'
import { AdminCategoriesView } from '@/components/famar/admin-categories-view'
import { Skeleton } from '@/components/ui/skeleton'

function AppContent() {
  const { currentView } = useAppStore()
  const { isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const { selectProduct, navigate } = useAppStore()

  // Handle shared product URL: ?p=FAM-AR001
  useEffect(() => {
    const productCode = searchParams.get('p')
    if (productCode) {
      // Remove ?p= from the URL so navigating away doesn't reopen the product
      window.history.replaceState(null, '', window.location.pathname)
      fetch(`/api/products?search=${encodeURIComponent(productCode)}&limit=1`)
        .then((res) => res.json())
        .then((data) => {
          const product = data.products?.[0]
          if (product) {
            selectProduct(product.id)
            navigate('product-detail')
          }
        })
        .catch(() => {})
    }
  }, [searchParams, selectProduct, navigate])

  // Redirect to login if trying to access admin without auth
  const isAdminView =
    currentView === 'admin-dashboard' ||
    currentView === 'admin-products' ||
    currentView === 'admin-orders' ||
    currentView === 'admin-categories'

  if (isAdminView && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <AdminLoginView />
        </main>
        <SiteFooter />
        <ScrollToTop />
      </div>
    )
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />
      case 'catalog':
        return <CatalogView />
      case 'product-detail':
        return <ProductDetailView />
      case 'cart':
        return <CartView />
      case 'out-of-stock':
        return <OutOfStockView />
      case 'contact':
        return <ContactView />
      case 'favorites':
        return <FavoritesView />
      case 'admin-login':
        return <AdminLoginView />
      case 'admin-dashboard':
        return (
          <AdminLayout>
            <AdminDashboardView />
          </AdminLayout>
        )
      case 'admin-products':
        return (
          <AdminLayout>
            <AdminProductsView />
          </AdminLayout>
        )
      case 'admin-orders':
        return (
          <AdminLayout>
            <AdminOrdersView />
          </AdminLayout>
        )
      case 'admin-categories':
        return (
          <AdminLayout>
            <AdminCategoriesView />
          </AdminLayout>
        )
      default:
        return <HomeView />
    }
  }

  const isAdmin = isAdminView

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <SiteHeader />}
      <main className="flex-1">{renderView()}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <WhatsAppButton />}
      <ScrollToTop />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-16 border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Skeleton className="h-8 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Skeleton className="h-64 w-full rounded-lg mb-8" />
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AppContent />
    </Suspense>
  )
}