'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
})
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAppStore, type AppView } from '@/stores/app-store'
import { ProductCard, type ProductData } from './product-card'
import { SkeletonGrid } from './skeleton-grid'
import { SearchBar } from './search-bar'
import { trackStoreEvent } from '@/lib/track-store-event'
import { demoHomeProducts } from '@/lib/demo-products'
import { Star, Truck, Shield, Heart, MessageCircle, Gem, Sparkles, X, ChevronLeft, ChevronRight, TicketPercent } from 'lucide-react'

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

interface Campaign {
  id: string
  title: string
  message: string | null
  image: string | null
  placement: 'popup' | 'banner'
  bannerImage: string | null
  popupImage: string | null
  displayMode: 'popup' | 'banner' | 'both'
  ctaLabel: string | null
  ctaView: AppView | null
  productIds: string[]
  coupon?: { id: string; code: string; discount: number } | null
  dailySaleLinked?: boolean
  investmentIds?: string[]
}

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const setCategory = useAppStore((s) => s.setCategory)
  const setCatalogFilter = useAppStore((s) => s.setCatalogFilter)
  const setCampaignFilter = useAppStore((s) => s.setCampaignFilter)
  const [newArrivalsOpen, setNewArrivalsOpen] = useState(false)
  const [popupIndex, setPopupIndex] = useState(0)
  const [bannerIndex, setBannerIndex] = useState(0)

  const goToCollection = (filter: string) => {
    setCatalogFilter(filter)
    navigate('catalog')
  }

  const { data: homeProducts, isLoading: loadingHomeProducts } = useQuery({
    queryKey: ['home-products'],
    queryFn: async () => {
      const response = await fetch('/api/home-products')
      if (!response.ok && process.env.NODE_ENV === 'development') return demoHomeProducts
      if (!response.ok) throw new Error('No se pudieron cargar los productos del inicio')
      return response.json() as Promise<{
        featuredProducts: ProductData[]
        newProducts: ProductData[]
        offers: ProductData[]
      }>
    },
  })
  const featuredProducts = homeProducts?.featuredProducts
  const newProducts = homeProducts?.newProducts
  const offers = homeProducts?.offers

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns')
      if (!response.ok) return []
      return response.json() as Promise<Campaign[]>
    },
    staleTime: 60_000,
  })

  const popupCampaigns = campaigns.filter((campaign) => (campaign.displayMode === 'popup' || campaign.displayMode === 'both' || (!campaign.displayMode && campaign.placement === 'popup')) && (campaign.popupImage || campaign.image))
  const bannerCampaigns = campaigns.filter((campaign) => (campaign.displayMode === 'banner' || campaign.displayMode === 'both' || (!campaign.displayMode && campaign.placement === 'banner')) && (campaign.bannerImage || campaign.image))
  const popupCampaign = popupCampaigns[popupIndex % Math.max(1, popupCampaigns.length)]
  const bannerCampaign = bannerCampaigns[bannerIndex % Math.max(1, bannerCampaigns.length)]

  useEffect(() => {
    if (!popupCampaign) return
    const timer = window.setTimeout(() => setNewArrivalsOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [popupCampaigns.length])

  const previousPopup = () => setPopupIndex((index) => (index - 1 + popupCampaigns.length) % popupCampaigns.length)
  const nextPopup = () => setPopupIndex((index) => (index + 1) % popupCampaigns.length)
  const previousBanner = () => setBannerIndex((index) => (index - 1 + bannerCampaigns.length) % bannerCampaigns.length)
  const nextBanner = () => setBannerIndex((index) => (index + 1) % bannerCampaigns.length)

  const followCampaign = (campaign: Campaign) => {
    trackStoreEvent('campaign_click', { campaignId: campaign.id })
    setNewArrivalsOpen(false)
    setCampaignFilter({ id: campaign.id, title: campaign.title, couponCode: campaign.coupon?.code, couponDiscount: campaign.coupon?.discount })
    if (campaign.ctaView === 'catalog') {
      setCatalogFilter(campaign.dailySaleLinked ? 'sale' : null)
    }
    if (campaign.ctaView) navigate(campaign.ctaView)
  }

  const { data: reviews } = useQuery({
    queryKey: ['reviews'],
    queryFn: async () => {
      const res = await fetch('/api/reviews')
      return res.json()
    },
  })

  const features = [
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: 'Calidad Garantizada',
      desc: 'Todos nuestros productos pasan por un riguroso control de calidad.',
    },
    {
      icon: <Truck className="h-8 w-8 text-primary" />,
      title: 'Envíos a Todo el País',
      desc: 'Realizamos envíos a todo el territorio ecuatoriano.',
    },
    {
      icon: <Heart className="h-8 w-8 text-primary" />,
      title: 'Atención Personalizada',
      desc: 'Te asesoramos en la elección del producto perfecto para ti.',
    },
    {
      icon: <Gem className="h-8 w-8 text-primary" />,
      title: 'Precios Accesibles',
      desc: 'Las mejores joyas y accesorios a precios justos y competitivos.',
    },
  ]

  return (
    <div className="flex flex-col">
      <Dialog open={Boolean(popupCampaign) && newArrivalsOpen} onOpenChange={setNewArrivalsOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border-primary/40 bg-black p-0 text-white shadow-2xl sm:rounded-2xl">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-3 top-3 z-20 shadow-lg"
            onClick={() => setNewArrivalsOpen(false)}
          >
            <X className="mr-1 h-4 w-4" />Cerrar
          </Button>
          {(popupCampaign?.popupImage || popupCampaign?.image) && <button type="button" className="relative block shrink-0 overflow-hidden" onClick={() => followCampaign(popupCampaign)} aria-label={`Abrir ${popupCampaign.title}`}>
            <img
              src={popupCampaign.popupImage || popupCampaign.image || ''}
              alt={popupCampaign.title}
              className="h-[38dvh] min-h-40 max-h-80 w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
          </button>}
          {popupCampaigns.length > 1 && <><Button type="button" size="icon" variant="secondary" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={previousPopup} aria-label="Publicidad anterior"><ChevronLeft className="h-5 w-5" /></Button><Button type="button" size="icon" variant="secondary" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={nextPopup} aria-label="Publicidad siguiente"><ChevronRight className="h-5 w-5" /></Button></>}
          <div className="min-h-0 space-y-2.5 overflow-y-auto px-4 pb-4 pt-3 text-center sm:space-y-3 sm:px-7 sm:pb-6">
            <DialogTitle className={`${playfair.className} break-words text-xl font-bold leading-tight text-primary sm:text-2xl`}>
              {popupCampaign?.title}
            </DialogTitle>
            {popupCampaign?.message && <DialogDescription className="mx-auto max-w-xl break-words text-xs leading-relaxed text-white/75 sm:text-sm">
              {popupCampaign.message}
            </DialogDescription>}
            {popupCampaign?.coupon && <div className="mx-auto inline-flex max-w-full flex-wrap items-center justify-center rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary sm:text-sm"><TicketPercent className="mr-1.5 h-4 w-4 shrink-0" /><span className="break-all">Cupón {popupCampaign.coupon.code} · {popupCampaign.coupon.discount}% OFF</span></div>}
            {popupCampaign?.ctaLabel && popupCampaign.ctaView && <div className="flex flex-col-reverse justify-center gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto sm:px-8"
                onClick={() => setNewArrivalsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto sm:px-8"
                onClick={() => followCampaign(popupCampaign)}
              >
                {popupCampaign.ctaLabel}
              </Button>
            </div>}
            {popupCampaigns.length > 1 && <div className="flex justify-center gap-1.5">{popupCampaigns.map((campaign, index) => <button key={campaign.id} type="button" className={`h-1.5 rounded-full transition-all ${index === popupIndex % popupCampaigns.length ? 'w-6 bg-primary' : 'w-1.5 bg-white/35'}`} onClick={() => setPopupIndex(index)} aria-label={`Ver publicidad ${index + 1}`} />)}</div>}
          </div>
        </DialogContent>
      </Dialog>

      {bannerCampaign && <div className="relative w-full">
        <button
          key={bannerCampaign.id}
          type="button"
          className="group relative block h-32 w-full overflow-hidden border-b border-primary/30 bg-black text-left text-white sm:h-40"
          onClick={() => followCampaign(bannerCampaign)}
          aria-label={`Abrir campaña ${bannerCampaign.title}`}
        >
          <img src={bannerCampaign.bannerImage || bannerCampaign.image || ''} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/25" />
          <div className="container relative mx-auto flex h-full items-center px-12 py-3 sm:px-16 sm:py-4">
            <div className="min-w-0 max-w-xl space-y-1.5">
              <p className={`${playfair.className} line-clamp-2 break-words text-lg font-bold leading-tight text-primary sm:text-2xl`}>{bannerCampaign.title}</p>
              {bannerCampaign.message && <p className="line-clamp-2 break-words text-xs leading-snug text-white/80 sm:text-sm">{bannerCampaign.message}</p>}
              <div className="flex max-w-full flex-wrap items-center gap-1.5">
                {bannerCampaign.coupon && <span className="inline-flex max-w-full items-center rounded-full border border-primary/50 bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-primary sm:text-xs"><TicketPercent className="mr-1 h-3.5 w-3.5 shrink-0" /><span className="truncate">Cupón {bannerCampaign.coupon.code} · {bannerCampaign.coupon.discount}% OFF</span></span>}
                {bannerCampaign.ctaLabel && bannerCampaign.ctaView && <span className="inline-flex max-w-full truncate rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{bannerCampaign.ctaLabel}</span>}
              </div>
            </div>
          </div>
        </button>
        {bannerCampaigns.length > 1 && <><Button type="button" size="icon" variant="secondary" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={previousBanner} aria-label="Banner anterior"><ChevronLeft className="h-5 w-5" /></Button><Button type="button" size="icon" variant="secondary" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={nextBanner} aria-label="Banner siguiente"><ChevronRight className="h-5 w-5" /></Button><div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">{bannerCampaigns.map((campaign, index) => <button key={campaign.id} type="button" className={`h-1.5 rounded-full transition-all ${index === bannerIndex % bannerCampaigns.length ? 'w-6 bg-primary' : 'w-1.5 bg-white/45'}`} onClick={() => setBannerIndex(index)} aria-label={`Ver banner ${index + 1}`} />)}</div></>}
      </div>}

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center max-md:hidden" />
        <div className="absolute inset-0 bg-[url('/hero-bg-mobile.jpg')] bg-cover bg-center md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/60" />
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className={`${playfair.className} text-5xl sm:text-7xl md:text-8xl font-semibold tracking-[0.12em] mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]`}
          >
            <span className="gold-gradient-text">FAMAR</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg sm:text-xl text-white/80 mb-2"
          >
            Joyería y Accesorios de Moda
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm text-white/60 mb-8"
          >
            Descubre nuestra colección exclusiva de piezas que realzan tu estilo
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8"
              onClick={() => {
                setCatalogFilter(null)
                navigate('catalog')
              }}
            >
              Ver Catálogo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 text-base px-8"
              onClick={() => navigate('contact')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Contáctanos
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Search bar */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="max-w-md mx-auto">
          <SearchBar onSearch={() => navigate('catalog')} />
        </div>
      </section>

      {/* Offers */}
      {loadingHomeProducts || (offers && offers.length > 0) ? (
        <section className="container mx-auto px-4 py-16">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="space-y-6">
            <motion.div variants={fadeInUp} custom={0} className="flex items-center gap-3">
              <TicketPercent className="h-6 w-6 text-primary" />
              <h2 className="cursor-pointer text-2xl font-bold transition-colors hover:text-primary" onClick={() => goToCollection('sale')}>
                Ofertas
              </h2>
            </motion.div>
            {loadingHomeProducts ? <SkeletonGrid count={4} /> : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {offers?.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
                </div>
                <div className="flex justify-center">
                  <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => goToCollection('sale')}>
                    Ver todas las ofertas
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </section>
      ) : null}

      {/* Featured Products */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="space-y-6"
        >
          <motion.div variants={fadeInUp} custom={0} className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2
              className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => goToCollection('featured')}
            >
              Productos Destacados
            </h2>
          </motion.div>
          {loadingHomeProducts ? (
            <SkeletonGrid count={4} />
          ) : featuredProducts && featuredProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {featuredProducts.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => goToCollection('featured')}
                >
                  Ver más destacados
                </Button>
              </div>
            </>
          ) : null}
        </motion.div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="space-y-6"
          >
            <motion.div variants={fadeInUp} custom={0} className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => goToCollection('new')}
              >
                Nuevos Ingresos
              </h2>
            </motion.div>
            {loadingHomeProducts ? (
              <SkeletonGrid count={4} />
            ) : newProducts && newProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {newProducts.map((product, i) => (
                    <ProductCard key={product.id} product={product} index={i} />
                  ))}
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => goToCollection('new')}
                  >
                    Ver más nuevos
                  </Button>
                </div>
              </>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* Why buy with us */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="space-y-8"
        >
          <motion.h2 variants={fadeInUp} custom={0} className="text-2xl font-bold text-center">
            ¿Por qué comprar con nosotros?
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} variants={fadeInUp} custom={i + 1}>
                <Card className="text-center p-6 border hover:shadow-lg transition-all hover:border-primary/30">
                  <div className="flex justify-center mb-4">{feature.icon}</div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              className="space-y-6"
            >
              <motion.h2 variants={fadeInUp} custom={0} className="text-2xl font-bold text-center">
                Opiniones de Clientes
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reviews.map((review: { id: string; author: string; text: string; rating: number }, i: number) => (
                  <motion.div key={review.id} variants={fadeInUp} custom={i + 1}>
                    <Card className="p-6 border hover:shadow-md transition-all">
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`h-4 w-4 ${
                              idx < review.rating
                                ? 'fill-primary text-primary'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 italic">
                        &ldquo;{review.text}&rdquo;
                      </p>
                      <p className="text-sm font-medium">— {review.author}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  )
}
