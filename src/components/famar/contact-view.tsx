'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, Mail, MapPin, Clock, MessageCircle, Store } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export function ContactView() {
  const { data } = useQuery({ queryKey: ['commerce-settings'], queryFn: () => fetch('/api/commerce-settings').then((response) => response.json()) })
  const tiers = data?.tiers || [
    { min: 50, discount: 10, label: '10% OFF automático' },
    { min: 100, discount: 20, label: '20% OFF + Atención personalizada' },
  ]
  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
        <h1 className="text-2xl font-bold">Contáctanos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estamos aquí para ayudarte con cualquier consulta
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Cards */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={1} className="space-y-4">
          <Card>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">WhatsApp</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  La forma más rápida de comunicarte con nosotros
                </p>
                <a
                  href="https://wa.me/593988215076?text=%C2%A1Hola!%20Me%20interesa%20conocer%20m%C3%A1s%20sobre%20sus%20productos."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-[#25D366] text-white hover:bg-[#25D366]/90">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    +593 988 215 076
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Teléfono</h3>
                <p className="text-sm text-muted-foreground mb-2">Llámanos directamente</p>
                <a href="tel:+593988215076" className="text-primary hover:underline text-sm">
                  +593 988 215 076
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Email</h3>
                <p className="text-sm text-muted-foreground mb-2">Escríbenos cuando quieras</p>
                <a href="mailto:info@famar.ec" className="text-primary hover:underline text-sm">
                  info@famar.ec
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Ubicación</h3>
                <p className="text-sm text-muted-foreground">Babahoyo, Ecuador</p>
                <p className="text-xs text-muted-foreground mt-1">Envíos a todo el país</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Horario de Atención</h3>
                <p className="text-sm text-muted-foreground">Lunes a Viernes: 9:00 - 18:00</p>
                <p className="text-sm text-muted-foreground">Sábados: 9:00 - 13:00</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={2} className="space-y-6">
          <Card className="overflow-hidden border-primary/30">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-primary to-primary/75 p-7 text-primary-foreground">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                  <Store className="h-6 w-6" />
                </div>
                <p className="mb-1 text-sm font-medium text-primary-foreground/80">Oportunidad para emprendedores</p>
                <h3 className="mb-3 text-2xl font-bold">Haz tu propio negocio</h3>
                <div className="mb-6 space-y-3 text-sm leading-relaxed text-primary-foreground/95">
                  <p>¿Quieres revender Famar Jewelry? Empieza con beneficios automáticos para hacer crecer tu negocio.</p>
                  {tiers.map((tier: { min: number; discount: number; label: string }) => <div key={`${tier.min}-${tier.discount}`} className="rounded-lg bg-black/10 p-3"><strong>Compra desde ${tier.min} USD</strong> y recibe <strong>{tier.discount}% OFF</strong>{tier.label.replace(new RegExp(`^${tier.discount}% OFF\\s*`, 'i'), ' ')}</div>)}
                </div>
                <a
                  href="https://wa.me/593988215076?text=%C2%A1Hola!%20Quiero%20informaci%C3%B3n%20para%20revender%20Famar%20Jewelry%20y%20acceder%20al%20descuento%20para%20emprendedores."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="secondary" className="w-full">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Quiero empezar a vender
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
