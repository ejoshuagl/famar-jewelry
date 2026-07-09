'use client'

import { useState } from 'react'
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
  X,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

const sidebarItems: { label: string; view: AppView; icon: React.ReactNode }[] = [
  { label: 'Dashboard', view: 'admin-dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Productos', view: 'admin-products', icon: <Package className="h-4 w-4" /> },
  { label: 'Pedidos', view: 'admin-orders', icon: <ShoppingBag className="h-4 w-4" /> },
  { label: 'Categorías', view: 'admin-categories', icon: <Tags className="h-4 w-4" /> },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, navigate } = useAppStore()
  const { logout } = useAuthStore()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg gold-gradient-text">FAMAR</span>
        <span className="text-xs text-muted-foreground ml-auto">Admin</span>
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {sidebarItems.map((item) => (
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
            navigate('home')
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
          <X className="h-4 w-4" />
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
  const { adminName, isAuthenticated } = useAuthStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('admin-login')
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card shrink-0">
        <div className="sticky top-16 h-[calc(100vh-4rem)]">
          <ScrollArea className="h-full">
            <SidebarNav />
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-64 bg-card border-r"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarNav onNavigate={() => setMobileSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="p-4 md:p-6">
          {/* Mobile header */}
          <div className="flex items-center justify-between mb-4 md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-4 w-4 mr-2" />
              Menú
            </Button>
            <span className="text-sm text-muted-foreground">{adminName}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}