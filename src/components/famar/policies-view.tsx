'use client'

import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight, CheckCircle2, Clock3, Database, FileCheck2, LockKeyhole,
  MessageCircle, PackageCheck, RefreshCcw, Scale, ShieldCheck, Truck,
} from 'lucide-react'

const whatsappUrl = 'https://wa.me/593988215076?text=Hola%20FAMAR%2C%20necesito%20ayuda%20con%20las%20pol%C3%ADticas%20de%20mi%20compra.'

const policyLinks = [
  { id: 'envios', label: 'Envíos', icon: Truck },
  { id: 'cambios', label: 'Cambios y devoluciones', icon: RefreshCcw },
  { id: 'privacidad', label: 'Privacidad', icon: LockKeyhole },
  { id: 'datos', label: 'Tus datos', icon: Database },
  { id: 'condiciones', label: 'Condiciones', icon: FileCheck2 },
]

export function PoliciesView() {
  const navigate = useAppStore((state) => state.navigate)

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <section className="relative overflow-hidden border-b border-primary/15">
        <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative mx-auto px-4 py-14 text-center sm:py-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">Compra con tranquilidad</p>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Claridad antes, durante y después de tu compra</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Reunimos en un solo lugar cómo enviamos tus joyas, cómo te ayudamos si algo no sale bien y cómo protegemos la información que nos confías.
          </p>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              ['Información clara', 'Sin letras pequeñas ni costos ocultos.'],
              ['Acompañamiento real', 'Atención directa por WhatsApp.'],
              ['Datos protegidos', 'Solo usamos lo necesario para atenderte.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-primary/15 bg-background/75 p-4 shadow-sm backdrop-blur">
                <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 border-b bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {policyLinks.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => jumpTo(id)} className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary">
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl space-y-7 px-4 py-10 sm:py-14">
        <PolicySection id="envios" number="01" icon={Truck} title="Política de envíos" subtitle="Te mantenemos informada desde la confirmación hasta la entrega.">
          <PolicyGrid items={[
            ['Cobertura', 'Realizamos envíos dentro de Ecuador. La disponibilidad, empresa transportista, costo estimado y plazo se confirman antes de que realices el pago.'],
            ['Preparación', 'El pedido se prepara después de validar el pago. Los tiempos pueden variar por ciudad, fines de semana, feriados o novedades de la transportista.'],
            ['Dirección correcta', 'Verifica nombre, teléfono, ciudad, dirección y referencia. Si los datos son incorrectos o incompletos, la entrega puede retrasarse o generar un nuevo costo de envío.'],
            ['Seguimiento', 'Cuando corresponda, te compartiremos la guía o información disponible para que puedas seguir tu pedido.'],
          ]} />
          <Notice icon={PackageCheck}>Al recibir el paquete, revisa que el empaque esté íntegro. Si notas manipulación o daño visible, toma fotografías antes de abrirlo y escríbenos.</Notice>
        </PolicySection>

        <PolicySection id="cambios" number="02" icon={RefreshCcw} title="Cambios, devoluciones y novedades" subtitle="Queremos resolverlo de forma justa, rápida y cercana.">
          <div className="grid gap-4 md:grid-cols-3">
            <Step number="1" title="Contáctanos" text="Escríbenos dentro de los 3 días posteriores a recibir la compra e indica tu número de pedido." />
            <Step number="2" title="Muéstranos el detalle" text="Envía fotos claras del producto, empaque y novedad para poder evaluarla." />
            <Step number="3" title="Te damos solución" text="Confirmaremos si corresponde cambio, devolución u otra solución y te explicaremos el proceso." />
          </div>
          <PolicyGrid items={[
            ['Condición del producto', 'La pieza debe conservar el mismo estado en que fue recibida, sin uso, alteraciones, manchas, olores ni daños, junto con su empaque cuando aplique.'],
            ['Producto incorrecto o defectuoso', 'Si recibiste una pieza distinta o con una novedad de origen, contáctanos de inmediato. Después de verificarla, coordinaremos una solución sin limitar tus derechos legales.'],
            ['Preferencia personal', 'Los cambios por color, modelo o preferencia están sujetos a disponibilidad. Antes de enviar una pieza, espera nuestras instrucciones.'],
            ['Excepciones razonables', 'Por higiene y naturaleza del producto, algunas piezas usadas o que hayan perdido su condición original pueden no admitir devolución. Cada caso se revisará conforme a la ley.'],
          ]} />
          <Notice icon={Clock3}>Las compras realizadas por internet cuentan con el derecho de devolución previsto por la legislación ecuatoriana, ejercible dentro de los tres días posteriores a la recepción cuando la naturaleza y el estado del bien lo permitan.</Notice>
        </PolicySection>

        <PolicySection id="privacidad" number="03" icon={LockKeyhole} title="Política de privacidad" subtitle="Tu información se utiliza para atenderte, no para invadirte.">
          <PolicyGrid items={[
            ['Qué recopilamos', 'Nombre, teléfono, ciudad, dirección o ubicación que decidas compartir, productos solicitados, observaciones y datos técnicos básicos de navegación.'],
            ['Para qué lo usamos', 'Crear y confirmar pedidos, coordinar pagos y entregas, brindarte soporte, prevenir errores o fraude y mejorar el funcionamiento de la tienda.'],
            ['Con quién se comparte', 'Solo con proveedores necesarios para operar el servicio, como transporte, alojamiento, base de datos, analítica y WhatsApp, según la función que cumplen.'],
            ['Durante cuánto tiempo', 'Conservamos la información durante el tiempo necesario para gestionar la compra, atender reclamos y cumplir obligaciones legales, contables o de seguridad.'],
          ]} />
          <Notice icon={ShieldCheck}>No vendemos tus datos personales. Aplicamos medidas razonables para evitar accesos, alteraciones o divulgaciones no autorizadas.</Notice>
        </PolicySection>

        <PolicySection id="datos" number="04" icon={Database} title="Tratamiento y control de tus datos" subtitle="Tú mantienes el control sobre la información que te pertenece.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {['Acceder a tus datos', 'Corregir o actualizar', 'Solicitar eliminación', 'Oponerte al marketing'].map((right) => (
              <div key={right} className="rounded-xl border bg-muted/25 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">{right}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Puedes ejercer tus derechos de acceso, rectificación, actualización, eliminación, oposición y demás derechos aplicables escribiendo a <a className="font-medium text-primary hover:underline" href="mailto:info@famar.ec">info@famar.ec</a> o por WhatsApp. Podremos solicitar información razonable para verificar que eres la titular antes de atender la solicitud.
          </p>
        </PolicySection>

        <PolicySection id="condiciones" number="05" icon={FileCheck2} title="Condiciones de compra" subtitle="Un acuerdo sencillo para evitar sorpresas.">
          <PolicyGrid items={[
            ['Disponibilidad', 'El pedido queda sujeto a confirmación de existencia. Si una pieza deja de estar disponible antes de confirmar el pago, te ofreceremos alternativas o cancelaremos esa pieza.'],
            ['Precios y promociones', 'Aplican los precios, descuentos y condiciones mostrados al momento de solicitar el pedido. Las ofertas no reciben descuentos adicionales cuando así se indique.'],
            ['Confirmación y pago', 'Solicitar un pedido no significa que el pago esté confirmado. Te enviaremos las instrucciones oficiales y validaremos el comprobante antes de preparar la entrega.'],
            ['Imágenes y características', 'Procuramos representar cada pieza con fidelidad. El color puede variar ligeramente por iluminación o pantalla; las medidas y materiales indicados ayudan a valorar el producto.'],
          ]} />
          <p className="text-xs leading-5 text-muted-foreground">Estas políticas complementan y no sustituyen los derechos reconocidos por la legislación ecuatoriana. Última actualización: agosto de 2026.</p>
        </PolicySection>

        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background">
          <CardContent className="flex flex-col items-center gap-5 p-7 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-lg font-bold">¿Tienes una duda sobre tu compra?</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuéntanos qué ocurrió y te acompañaremos personalmente.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => navigate('contact')}>Ver contacto</Button>
              <Button asChild><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Hablar con FAMAR</a></Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <Scale className="h-4 w-4 text-primary" />
          <span>Referencias oficiales:</span>
          <a className="hover:text-primary hover:underline" href="https://www.produccion.gob.ec/wp-content/uploads/2025/03/LEY-ORGANICA-DE-DEFENSA-DEL-CONSUMIDOR_2022_02_11.pdf" target="_blank" rel="noopener noreferrer">Defensa del consumidor</a>
          <span>•</span>
          <a className="hover:text-primary hover:underline" href="https://www.gob.ec/sites/default/files/regulations/2025-01/01%20Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf" target="_blank" rel="noopener noreferrer">Protección de datos</a>
        </div>
      </div>
    </main>
  )
}

function PolicySection({ id, number, icon: Icon, title, subtitle, children }: { id: string; number: string; icon: typeof Truck; title: string; subtitle: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-36 rounded-2xl border bg-card/70 p-5 shadow-sm sm:p-8">
    <div className="mb-6 flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div><p className="text-[10px] font-bold tracking-[0.25em] text-primary">POLÍTICA {number}</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>
}

function PolicyGrid({ items }: { items: string[][] }) {
  return <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">{items.map(([title, text]) => <div key={title}><div className="mb-1 flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-primary" /><h3 className="text-sm font-semibold">{title}</h3></div><p className="pl-5 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div>
}

function Notice({ icon: Icon, children }: { icon: typeof Truck; children: React.ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm leading-6"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>{children}</p></div>
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="relative rounded-xl border bg-muted/20 p-5"><span className="absolute right-4 top-3 text-3xl font-black text-primary/10">{number}</span><p className="font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>
}
