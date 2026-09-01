'use client'

import { Suspense, useEffect, type ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { restoreAppFromLocation, useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { SiteHeader } from '@/components/famar/site-header'
import { SiteFooter } from '@/components/famar/site-footer'
import { FloatingCartButton } from '@/components/famar/floating-cart-button'
import { ScrollToTop } from '@/components/famar/scroll-to-top'
import { SiteTheme } from '@/components/famar/site-theme'
import { CartReminder } from '@/components/famar/cart-reminder'
import { Skeleton } from '@/components/ui/skeleton'

const loadView = () => <div className="container mx-auto px-4 py-10"><Skeleton className="h-96 w-full rounded-lg" /></div>
const dynamicView = <T extends object>(loader: () => Promise<T>, name: keyof T) =>
  dynamic(async () => (await loader())[name] as ComponentType, { loading: loadView })

const HomeView = dynamicView(() => import('@/components/famar/home-view'), 'HomeView')
const CatalogView = dynamicView(() => import('@/components/famar/catalog-view'), 'CatalogView')
const ProductDetailView = dynamicView(() => import('@/components/famar/product-detail-view'), 'ProductDetailView')
const CartView = dynamicView(() => import('@/components/famar/cart-view'), 'CartView')
const OutOfStockView = dynamicView(() => import('@/components/famar/out-of-stock-view'), 'OutOfStockView')
const ContactView = dynamicView(() => import('@/components/famar/contact-view'), 'ContactView')
const JewelryCareView = dynamicView(() => import('@/components/famar/jewelry-care-section'), 'JewelryCareView')
const PoliciesView = dynamicView(() => import('@/components/famar/policies-view'), 'PoliciesView')
const FavoritesView = dynamicView(() => import('@/components/famar/favorites-view'), 'FavoritesView')
const AdminLoginView = dynamicView(() => import('@/components/famar/admin-login-view'), 'AdminLoginView')
const AdminLayout = dynamic(() => import('@/components/famar/admin-layout').then((module) => module.AdminLayout), { loading: loadView })
const AdminDashboardView = dynamicView(() => import('@/components/famar/admin-dashboard-view'), 'AdminDashboardView')
const AdminProductsView = dynamicView(() => import('@/components/famar/admin-products-view'), 'AdminProductsView')
const AdminOrdersView = dynamicView(() => import('@/components/famar/admin-orders-view'), 'AdminOrdersView')
const AdminCategoriesView = dynamicView(() => import('@/components/famar/admin-categories-view'), 'AdminCategoriesView')
const AdminCampaignsView = dynamicView(() => import('@/components/famar/admin-campaigns-view'), 'AdminCampaignsView')
const AdminThemesView = dynamicView(() => import('@/components/famar/admin-themes-view'), 'AdminThemesView')
const AdminWholesaleView = dynamicView(() => import('@/components/famar/admin-wholesale-view'), 'AdminWholesaleView')
const AdminCouponsView = dynamicView(() => import('@/components/famar/admin-coupons-view'), 'AdminCouponsView')

export function AppContent() {
  const { currentView, selectedProductId, selectedProductCode } = useAppStore()
  const { isAuthenticated } = useAuthStore()
  const { selectProduct } = useAppStore()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()

  // Client components can be pre-rendered with the home state. Reconcile the
  // store with the real address as soon as the browser hydrates a direct URL.
  useEffect(() => {
    restoreAppFromLocation()
  }, [pathname, searchString])

  // Handle direct product URLs such as /producto/FAM-AR001.
  useEffect(() => {
    const productCode = selectedProductCode
    if (currentView === 'product-detail' && productCode && !selectedProductId) {
      const controller = new AbortController()
      fetch(`/api/products?code=${encodeURIComponent(productCode)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const product = data.product
          const activeCode = useAppStore.getState().selectedProductCode
          if (product && useAppStore.getState().currentView === 'product-detail' && activeCode === productCode) {
            selectProduct(product.id, product.code)
          }
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') console.error('Error restoring product:', error)
        })
      return () => controller.abort()
    }
  }, [selectedProductCode, selectProduct, currentView, selectedProductId])

  const restoringProduct = currentView === 'product-detail'
    && Boolean(selectedProductCode)
    && !selectedProductId

  // Redirect to login if trying to access admin without auth
  const isAdminView =
    currentView === 'admin-dashboard' ||
    currentView === 'admin-products' ||
    currentView === 'admin-orders' ||
    currentView === 'admin-categories' ||
    currentView === 'admin-campaigns'
    || currentView === 'admin-themes'
    || currentView === 'admin-wholesale'
    || currentView === 'admin-coupons'

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
      case 'policies':
        return <PoliciesView />
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
      case 'admin-wholesale':
        return <AdminLayout><AdminWholesaleView /></AdminLayout>
      case 'admin-coupons':
        return <AdminLayout><AdminCouponsView /></AdminLayout>
      default:
        return <HomeView />
    }
  }

  const isAdmin = isAdminView

  return (
    <div className={`${isAdmin ? 'admin-app' : 'public-store'} min-h-screen flex flex-col`}>
      {!isAdmin && <SiteTheme />}
      {!isAdmin && <SiteHeader />}
      <main className="flex-1">{renderView()}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <FloatingCartButton />}
      {!isAdmin && <CartReminder />}
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
