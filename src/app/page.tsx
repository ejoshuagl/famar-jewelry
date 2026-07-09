'use client'

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

export default function Home() {
  const { currentView } = useAppStore()
  const { isAuthenticated } = useAuthStore()

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
        <WhatsAppButton />
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
      <SiteHeader />
      <main className="flex-1">{renderView()}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <WhatsAppButton />}
      <ScrollToTop />
    </div>
  )
}