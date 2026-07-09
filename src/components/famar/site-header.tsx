'use client'

import { useAppStore, AppView } from '@/stores/app-store'
import { useCartStore } from '@/stores/cart-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  Menu,
  ShoppingCart,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems: { label: string; view: AppView }[] = [
  { label: 'Inicio', view: 'home' },
  { label: 'Catálogo', view: 'catalog' },
  { label: 'Agotados', view: 'out-of-stock' },
  { label: 'Contacto', view: 'contact' },
]

export function SiteHeader() {
  const { currentView, navigate, sidebarOpen, setSidebarOpen } = useAppStore()
  const itemCount = useCartStore((s) => s.getItemCount())
  const favCount = useFavoritesStore((s) => s.ids.length)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <button
          onClick={() => navigate('home')}
          className="text-2xl font-bold tracking-wider gold-gradient-text"
        >
          FAMAR
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-colors',
                currentView === item.view
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
              {currentView === item.view && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => navigate('favorites')}
          >
            <Heart className="h-4 w-4" />
            {favCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                {favCount}
              </Badge>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => navigate('cart')}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                {itemCount}
              </Badge>
            )}
          </Button>

          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <div className="flex flex-col gap-1 mt-8">
                {navItems.map((item) => (
                  <button
                    key={item.view}
                    onClick={() => navigate(item.view)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors text-left',
                      currentView === item.view
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {item.label}
                    {currentView === item.view && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => navigate('favorites')}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors text-left text-foreground hover:bg-muted"
                >
                  Favoritos
                  {favCount > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {favCount}
                    </Badge>
                  )}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}