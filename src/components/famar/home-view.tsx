'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
})
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/stores/app-store'
import { ProductCard, type ProductData } from './product-card'
import { SkeletonGrid } from './skeleton-grid'
import { SearchBar } from './search-bar'
import { Star, Truck, Shield, Heart, MessageCircle, Gem, Sparkles, TrendingUp } from 'lucide-react'

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const setCategory = useAppStore((s) => s.setCategory)
  const setCatalogFilter = useAppStore((s) => s.setCatalogFilter)

  const goToCollection = (filter: string) => {
    setCatalogFilter(filter)
    navigate('catalog')
  }

  const { data: featuredProducts, isLoading: loadingFeatured } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const res = await fetch('/api/products?featured=true&limit=8')
      const data = await res.json()
      return data.products as ProductData[]
    },
  })

  const { data: newProducts, isLoading: loadingNew } = useQuery({
    queryKey: ['products', 'new'],
    queryFn: async () => {
      const res = await fetch('/api/products?new=true&limit=8')
      const data = await res.json()
      return data.products as ProductData[]
    },
  })

  const { data: bestSelling, isLoading: loadingBest } = useQuery({
    queryKey: ['products', 'best-selling'],
    queryFn: async () => {
      const res = await fetch('/api/products?sort=best-selling&limit=4')
      const data = await res.json()
      return data.products as ProductData[]
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
      title: 'Envíos Nationwide',
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
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center max-md:hidden" />
        <div className="absolute inset-0 bg-[url('/hero-bg-mobile.jpg')] bg-cover bg-center md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/60 max-md:from-black/40 max-md:via-black/10 max-md:to-black/40" />
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