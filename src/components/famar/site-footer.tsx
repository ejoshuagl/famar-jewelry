'use client'

import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/stores/app-store'
import { Instagram, Facebook, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react'

export function SiteFooter() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold gold-gradient-text mb-3">FAMAR</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Joyería y accesorios de moda con la mejor calidad. Encuentra el
              estilo perfecto para cada ocasión.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">
              Enlaces Rápidos
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Inicio', view: 'home' as const },
                { label: 'Catálogo', view: 'catalog' as const },
                { label: 'Agotados', view: 'out-of-stock' as const },
                { label: 'Contacto', view: 'contact' as const },
              ].map((link) => (
                <button
                  key={link.view}
                  onClick={() => navigate(link.view)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">
              Contacto
            </h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+593988215076" className="hover:text-foreground transition-colors">
                  +593 988 215 076
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:info@famar.ec" className="hover:text-foreground transition-colors">
                  info@famar.ec
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Ecuador</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <a
                  href="https://www.instagram.com/famar.ec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://www.facebook.com/famar.ec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="https://wa.me/593988215076"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-950 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FAMAR. Todos los derechos reservados.</p>
          <button
            onClick={() => navigate('admin-login')}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
          >
            <ShieldCheck className="h-3 w-3" />
            Admin
          </button>
        </div>
      </div>
    </footer>
  )
}