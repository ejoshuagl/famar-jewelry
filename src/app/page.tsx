'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { SiteHeader } from '@/components/famar/site-header'
import { SiteFooter } from '@/components/famar/site-footer'
import { FloatingCartButton } from '@/components/famar/floating-cart-button'
import { ScrollToTop } from '@/components/famar/scroll-to-top'
import { HomeView } from '@/components/famar/home-view'
import { CatalogView } from '@/components/famar/catalog-view'
import { ProductDetailView } from '@/components/famar/product-detail-view'
import { CartView } from '@/components/famar/cart-view'
import { OutOfStockView } from '@/components/famar/out-of-stock-view'
import { ContactView } from '@/components/famar/contact-view'
import { JewelryCareView } from '@/components/famar/jewelry-care-section'
import { FavoritesView } from '@/components/famar/favorites-view'
import { AdminLoginView } from '@/components/famar/admin-login-view'
import { AdminLayout } from '@/components/famar/admin-layout'
import { AdminDashboardView } from '@/components/famar/admin-dashboard-view'
import { AdminProductsView } from '@/components/famar/admin-products-view'
import { AdminOrdersView } from '@/components/famar/admin-orders-view'
import { AdminCategoriesView } from '@/components/famar/admin-categories-view'
import { AdminCampaignsView } from '@/components/famar/admin-campaigns-view'
import { AdminThemesView } from '@/components/famar/admin-themes-view'
import { SiteTheme } from '@/components/famar/site-theme'
import { Skeleton } from '@/components/ui/skeleton'

function AppContent() {
  const { currentView, selectedProductId } = useAppStore()
  const { isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const { selectProduct } = useAppStore()

  // Handle shared product URL: ?p=FAM-AR001
  useEffect(() => {
    const productCode = searchParams.get('p')
    if (currentView === 'product-detail' && productCode && !selectedProductId) {
      const controller = new AbortController()
      fetch(`/api/products?code=${encodeURIComponent(productCode)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const product = data.product
          const activeCode = new URLSearchParams(window.location.search).get('p')
          if (product && useAppStore.getState().currentView === 'product-detail' && activeCode === productCode) {
            selectProduct(product.id, product.code)
          }
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') console.error('Error restoring product:', error)
        })
      return () => controller.abort()
    }
  }, [searchParams, selectProduct, currentView, selectedProductId])

  const restoringProduct = currentView === 'product-detail'
    && Boolean(searchParams.get('p'))
    && !selectedProductId

  // Redirect to login if trying to access admin without auth
  const isAdminView =
    currentView === 'admin-dashboard' ||
    currentView === 'admin-products' ||
    currentView === 'admin-orders' ||
    currentView === 'admin-categories' ||
    currentView === 'admin-campaigns'
    || currentView === 'admin-themes'

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
        return restoringProduct ? (
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="mb-6 h-6 w-48" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Skeleton className="aspect-square rounded-lg" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          </div>
        ) : <ProductDetailView />
      case 'cart':
        return <CartView />
      case 'out-of-stock':
        return <OutOfStockView />
      case 'contact':
        return <ContactView />
      case 'jewelry-care':
        return <JewelryCareView />
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
      case 'admin-campaigns':
        return (
          <AdminLayout>
            <AdminCampaignsView />
          </AdminLayout>
        )
      case 'admin-themes':
        return (
          <AdminLayout>
            <AdminThemesView />
          </AdminLayout>
        )
      default:
        return <HomeView />
    }
  }

  const isAdmin = isAdminView

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <SiteTheme />}
      {!isAdmin && <SiteHeader />}
      <main className="flex-1">{renderView()}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <FloatingCartButton />}
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
