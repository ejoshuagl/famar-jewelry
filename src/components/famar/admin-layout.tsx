'use client'

import { useState, useEffect } from 'react'
import { useAppStore, type AppView } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tags,
  LogOut,
  Menu,
  ArrowLeft,
  ShieldCheck,
  Megaphone,
  Palette,
  Percent,
  TicketPercent,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminOrderNotifier } from './admin-order-notifier'

const WHATSAPP_NUMBER = '593988215076'

const sidebarItems: { label: string; view: AppView; permission: string; icon: React.ReactNode }[] = [
  { label: 'Dashboard', view: 'admin-dashboard', permission: 'dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Productos', view: 'admin-products', permission: 'products', icon: <Package className="h-4 w-4" /> },
  { label: 'Pedidos', view: 'admin-orders', permission: 'orders', icon: <ShoppingBag className="h-4 w-4" /> },
  { label: 'Categorías', view: 'admin-categories', permission: 'categories', icon: <Tags className="h-4 w-4" /> },
  { label: 'Publicidad', view: 'admin-campaigns', permission: 'campaigns', icon: <Megaphone className="h-4 w-4" /> },
  { label: 'Temas y estilos', view: 'admin-themes', permission: 'themes', icon: <Palette className="h-4 w-4" /> },
  { label: 'Mayoristas', view: 'admin-wholesale', permission: 'wholesale', icon: <Percent className="h-4 w-4" /> },
  { label: 'Cupones', view: 'admin-coupons', permission: 'coupons', icon: <TicketPercent className="h-4 w-4" /> },
  { label: 'Usuarios', view: 'admin-users', permission: 'users', icon: <Users className="h-4 w-4" /> },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, navigate } = useAppStore()
  const { logout, can } = useAuthStore()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg gold-gradient-text">FAMAR</span>
        <span className="text-xs text-muted-foreground ml-auto">Admin</span>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {sidebarItems.filter((item) => can(item.permission)).map((item) => (
          <button
            key={item.view}
            onClick={() => {
              navigate(item.view)
              onNavigate?.()
            }}
            className={cn(
              'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
              currentView === item.view
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <Separator />
      <div className="p-2 space-y-1">
        <button
          onClick={() => {
            logout()
            navigate('admin-login')
          }}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </button>
      </div>
    </div>
  )
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { navigate } = useAppStore()
  const { adminName, isAuthenticated, can } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('admin-login')
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      {can('orders') && <AdminOrderNotifier />}
      {/* Desktop sidebar — always one instance, visibility via CSS only */}
      <aside className="hidden lg:flex w-60 flex-col border-r bg-card shrink-0">
        <ScrollArea className="flex-1">
          <SidebarNav />
        </ScrollArea>
      </aside>

      {/* Mobile sidebar — rendered only when open, never simultaneously with desktop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          {/* drawer */}
          <aside className="relative z-10 flex h-full w-64 flex-col bg-card border-r">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-w-0 p-4 lg:p-6">
        {/* Mobile top bar (only visible on smaller screens) */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4 mr-2" />
            Menú
          </Button>
          <span className="text-sm text-muted-foreground">{adminName}</span>
        </div>

        {children}
      </div>
    </div>
  )
}
