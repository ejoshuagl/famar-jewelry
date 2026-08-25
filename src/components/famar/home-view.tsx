'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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
import { Star, Truck, Shield, Heart, MessageCircle, Gem, Sparkles, TrendingUp, X, ChevronLeft, ChevronRight } from 'lucide-react'

const fadeInUp = {
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
}

function pickRandomProducts(products: ProductData[], count = 4) {
  const shuffled = [...products]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled.slice(0, count)
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

  const { data: featuredProducts, isLoading: loadingFeatured } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const res = await fetch('/api/products?featured=true&limit=25')
      const data = await res.json()
      return pickRandomProducts(data.products as ProductData[])
    },
  })

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
    setNewArrivalsOpen(false)
    if (campaign.ctaView === 'catalog') {
      setCatalogFilter(null)
      setCampaignFilter(campaign.productIds.length ? { id: campaign.id, title: campaign.title } : null)
    }
    if (campaign.ctaView) navigate(campaign.ctaView)
  }

  const { data: newProducts, isLoading: loadingNew } = useQuery({
    queryKey: ['products', 'new'],
    queryFn: async () => {
      const res = await fetch('/api/products?new=true&limit=25')
      const data = await res.json()
      return pickRandomProducts(data.products as ProductData[])
    },
  })

  const { data: bestSelling, isLoading: loadingBest } = useQuery({
    queryKey: ['products', 'best-selling'],
    queryFn: async () => {
      const res = await fetch('/api/products?sort=best-selling&limit=20')
      const data = await res.json()
      return pickRandomProducts(data.products as ProductData[])
    },
  })


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
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl gap-0 overflow-hidden border-primary/40 bg-black p-0 text-white shadow-2xl sm:rounded-2xl">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-3 top-3 z-20 shadow-lg"
            onClick={() => setNewArrivalsOpen(false)}
          >
            <X className="mr-1 h-4 w-4" />Cerrar
          </Button>
          {(popupCampaign?.popupImage || popupCampaign?.image) && <button type="button" className="relative block w-full" onClick={() => followCampaign(popupCampaign)} aria-label={`Abrir ${popupCampaign.title}`}>
            <img
              src={popupCampaign.popupImage || popupCampaign.image || ''}
              alt={popupCampaign.title}
              className="aspect-square max-h-[58dvh] w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
          </button>}
          {popupCampaigns.length > 1 && <><Button type="button" size="icon" variant="secondary" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={previousPopup} aria-label="Publicidad anterior"><ChevronLeft className="h-5 w-5" /></Button><Button type="button" size="icon" variant="secondary" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-lg" onClick={nextPopup} aria-label="Publicidad siguiente"><ChevronRight className="h-5 w-5" /></Button></>}
          <div className="space-y-3 px-5 pb-5 pt-3 text-center sm:px-8 sm:pb-7">
            <DialogTitle className={`${playfair.className} text-2xl font-bold text-primary sm:text-3xl`}>
              {popupCampaign?.title}
            </DialogTitle>
            {popupCampaign?.message && <DialogDescription className="mx-auto max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              {popupCampaign.message}
            </DialogDescription>}
            {popupCampaign?.ctaLabel && popupCampaign.ctaView && <Button
              className="w-full sm:w-auto sm:px-8"
              onClick={() => followCampaign(popupCampaign)}
            >
              {popupCampaign.ctaLabel}
            </Button>}
            {popupCampaigns.length > 1 && <div className="flex justify-center gap-1.5">{popupCampaigns.map((campaign, index) => <button key={campaign.id} type="button" className={`h-1.5 rounded-full transition-all ${index === popupIndex % popupCampaigns.length ? 'w-6 bg-primary' : 'w-1.5 bg-white/35'}`} onClick={() => setPopupIndex(index)} aria-label={`Ver publicidad ${index + 1}`} />)}</div>}
          </div>
        </DialogContent>
      </Dialog>

      {bannerCampaign && <div className="relative w-full">
        <button
          key={bannerCampaign.id}
          type="button"
          className="group relative block min-h-44 w-full overflow-hidden border-b border-primary/30 bg-black text-left text-white sm:min-h-52"
          onClick={() => followCampaign(bannerCampaign)}
          aria-label={`Abrir campaña ${bannerCampaign.title}`}
        >
          <img src={bannerCampaign.bannerImage || bannerCampaign.image || ''} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/25" />
          <div className="container relative mx-auto flex min-h-44 items-center px-5 py-7 sm:min-h-52 sm:px-8">
            <div className="max-w-xl space-y-2">
              <p className={`${playfair.className} text-2xl font-bold text-primary sm:text-4xl`}>{bannerCampaign.title}</p>
              {bannerCampaign.message && <p className="text-sm text-white/80 sm:text-base">{bannerCampaign.message}</p>}
              {bannerCampaign.ctaLabel && bannerCampaign.ctaView && <span className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{bannerCampaign.ctaLabel}</span>}
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

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
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
          {loadingFeatured ? (
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
      </section>

      {/* New Arrivals */}
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
                onClick={() => goToCollection('new')}
              >
                Nuevos Ingresos
              </h2>
            </motion.div>
            {loadingNew ? (
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

      {/* Best Selling */}
      {bestSelling && bestSelling.length > 0 && (
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              className="space-y-6"
            >
              <motion.div variants={fadeInUp} custom={0} className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                <h2
                  className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => goToCollection('best-selling')}
                >
                  Más Vendidos
                </h2>
              </motion.div>
              {loadingBest ? (
                <SkeletonGrid count={4} />
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {bestSelling.map((product, i) => (
                      <ProductCard key={product.id} product={product} index={i} />
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => goToCollection('best-selling')}
                    >
                      Ver más vendidos
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </section>
      )}

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
