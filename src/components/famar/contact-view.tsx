'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, Mail, MapPin, Clock, MessageCircle, Instagram, Facebook } from 'lucide-react'
import { motion } from 'framer-motion'

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export function ContactView() {
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
                <p className="text-sm text-muted-foreground">Ecuador</p>
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

        {/* Social & CTA */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={2} className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 p-8 text-center">
              <h3 className="text-xl font-bold mb-2">¿Necesitas ayuda?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Nuestro equipo está listo para asesorarte en la elección perfecta
              </p>
              <a
                href="https://wa.me/593988215076?text=%C2%A1Hola!%20Necesito%20asesor%C3%ADa%20sobre%20un%20producto."
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="bg-[#25D366] text-white hover:bg-[#25D366]/90">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Chatear por WhatsApp
                </Button>
              </a>
            </div>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Síguenos en Redes Sociales</h3>
              <div className="space-y-3">
                <a
                  href="https://www.instagram.com/famar.ec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-950 flex items-center justify-center">
                    <Instagram className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Instagram</p>
                    <p className="text-xs text-muted-foreground">@famar.ec</p>
                  </div>
                </a>
                <a
                  href="https://www.facebook.com/famar.ec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <Facebook className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Facebook</p>
                    <p className="text-xs text-muted-foreground">FAMAR</p>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}