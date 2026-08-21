import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const db = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex')
}

const CATEGORIES = [
  { name: 'Aretes', slug: 'aretes', order: 1 },
  { name: 'Collares', slug: 'collares', order: 2 },
  { name: 'Pulseras', slug: 'pulseras', order: 3 },
  { name: 'Anillos', slug: 'anillos', order: 4 },
  { name: 'Tobilleras', slug: 'tobilleras', order: 5 },
  { name: 'Cadenas', slug: 'cadenas', order: 6 },
  { name: 'Dijes', slug: 'dijes', order: 7 },
  { name: 'Broches', slug: 'broches', order: 8 },
  { name: 'Accesorios para cabello', slug: 'accesorios-cabello', order: 9 },
  { name: 'Llaveros', slug: 'llaveros', order: 10 },
  { name: 'Bolsos', slug: 'bolsos', order: 11 },
  { name: 'Cosméticos', slug: 'cosmeticos', order: 12 },
  { name: 'Novedades', slug: 'novedades', order: 13 },
  { name: 'Promociones', slug: 'promociones', order: 14 },
]

const PRODUCTS = [
  // Aretes
  { code: 'FAM-AR001', name: 'Aretes Perla Dorada', categoryId: 'aretes', price: 8.50, stock: 15, material: 'Aleación dorada + perla', weight: '5g', dimensions: '2.5cm', color: 'Dorado', description: 'Elegantes aretes con diseño de perla y acabado dorado. Perfectos para ocasiones especiales.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-AR002', name: 'Aretes Mariposa Cristal', categoryId: 'aretes', price: 6.00, stock: 20, material: 'Acero inoxidable + cristal', weight: '4g', dimensions: '3cm', color: 'Plateado', description: 'Hermosos aretes de mariposa con incrustaciones de cristal brillante.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-AR003', name: 'Aretes Argolla Grande', categoryId: 'aretes', price: 5.50, stock: 30, material: 'Aleación dorada', weight: '8g', dimensions: '4cm', color: 'Dorado', description: 'Argollas grandes con acabado brillante. Tendencia de moda actual.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 45 },
  { code: 'FAM-AR004', name: 'Aretes Gotas Esmeralda', categoryId: 'aretes', price: 12.00, stock: 8, material: 'Plata 925 + esmeralda sintética', weight: '6g', dimensions: '3.5cm', color: 'Verde', description: 'Aretes de gota con esmeralda sintética de alta calidad.', isFeatured: true, isNew: false, isOnSale: false, salesCount: 28 },
  { code: 'FAM-AR005', name: 'Aretes Estrella Fuego', categoryId: 'aretes', price: 0, stock: 0, material: 'Aleación + circonitas', weight: '3g', dimensions: '2cm', color: 'Multicolor', description: 'Aretes de estrella con efecto de fuego en las circonitas.', isFeatured: false, isNew: false, isOnSale: false, status: 'out_of_stock', salesCount: 32 },

  // Collares
  { code: 'FAM-CO001', name: 'Collar Cadena Galardon', categoryId: 'collares', price: 15.00, stock: 12, material: 'Acero inoxidable dorado', weight: '12g', dimensions: '45cm + 5cm extensión', color: 'Dorado', description: 'Collar de cadena tipo galardon con acabado premium dorado.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-CO002', name: 'Collar Perla Natural', categoryId: 'collares', price: 18.50, stock: 10, material: 'Perlas naturales + plata 925', weight: '15g', dimensions: '50cm', color: 'Blanco', description: 'Collar de perlas naturales engarzadas en hilo de seda con cierre de plata.', isFeatured: true, isNew: false, isOnSale: false, salesCount: 55 },
  { code: 'FAM-CO003', name: 'Collar Choker Velour', categoryId: 'collares', price: 7.00, stock: 25, material: 'Terciopelo + acero', weight: '8g', dimensions: '35cm + 5cm', color: 'Negro', description: 'Choker de terciopelo con detalle central de acero. Muy moderno.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 67 },
  { code: 'FAM-CO004', name: 'Collar Corazón Cristal', categoryId: 'collares', price: 9.50, stock: 18, material: 'Aleación + cristal', weight: '7g', dimensions: '42cm + 5cm', color: 'Rosa', description: 'Collar con dije de corazón en cristal brillante. Regalo perfecto.', isFeatured: false, isNew: false, isOnSale: false, salesCount: 41 },

  // Pulseras
  { code: 'FAM-PU001', name: 'Pulsera Cadena Trenzada', categoryId: 'pulseras', price: 10.00, stock: 20, material: 'Acero inoxidable', weight: '10g', dimensions: '17cm + 4cm', color: 'Plateado', description: 'Pulsera de cadena trenzada en acero inoxidable. Diseño elegante y duradero.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-PU002', name: 'Pulsera Multicolor Charms', categoryId: 'pulseras', price: 8.00, stock: 15, material: 'Aleación + esmalte', weight: '12g', dimensions: '18cm elástico', color: 'Multicolor', description: 'Pulsera elástica con múltiples charms coloridos. Ideal para combinar.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 38 },
  { code: 'FAM-PU003', name: 'Pulsera Piedras Naturales', categoryId: 'pulseras', price: 14.00, stock: 3, material: 'Piedras naturales + hilo elástico', weight: '15g', dimensions: '17cm', color: 'Varios', description: 'Pulsera con piedras naturales de diferentes colores. Cada pieza es única.', isFeatured: true, isNew: false, isOnSale: false, salesCount: 22 },

  // Anillos
  { code: 'FAM-AN001', name: 'Anillo Solitario Zirconia', categoryId: 'anillos', price: 11.00, stock: 14, material: 'Plata 925 + zirconia', weight: '4g', dimensions: 'Ajustable', color: 'Plateado', description: 'Anillo solitario con zirconia de alta brillantez en plata 925.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-AN002', name: 'Anillo Serpiente Dorado', categoryId: 'anillos', price: 7.50, stock: 22, material: 'Aleación dorada', weight: '6g', dimensions: 'Ajustable', color: 'Dorado', description: 'Anillo con diseño de serpiente en acabado dorado. Tendencia de temporada.', isFeatured: false, isNew: false, isOnSale: false, salesCount: 51 },
  { code: 'FAM-AN003', name: 'Anillo Flor Diamante', categoryId: 'anillos', price: 16.00, stock: 0, material: 'Oro 18K + diamantes', weight: '3g', dimensions: 'Tallas 6-9', color: 'Dorado', description: 'Exquisito anillo de flor con diamantes naturales en oro de 18 quilates.', isFeatured: false, isNew: false, isOnSale: false, status: 'out_of_stock', salesCount: 15 },

  // Tobilleras
  { code: 'FAM-TO001', name: 'Tobillera Estrellitas', categoryId: 'tobilleras', price: 6.50, stock: 18, material: 'Acero inoxidable', weight: '8g', dimensions: '25cm + 5cm', color: 'Plateado', description: 'Tobillera con pequeñas estrellas de acero inoxidable. Perfecta para el verano.', isFeatured: false, isNew: true, isOnSale: false },
  { code: 'FAM-TO002', name: 'Tobillera Conchas', categoryId: 'tobilleras', price: 5.00, stock: 0, material: 'Aleación + conchas naturales', weight: '10g', dimensions: '22cm + 6cm', color: 'Natural', description: 'Tobillera bohemio con conchas naturales. Estilo playero.', isFeatured: false, isNew: false, isOnSale: false, status: 'out_of_stock', salesCount: 29 },

  // Cadenas
  { code: 'FAM-CA001', name: 'Cadena Vénus 50cm', categoryId: 'cadenas', price: 13.00, stock: 16, material: 'Acero inoxidable dorado', weight: '14g', dimensions: '50cm', color: 'Dorado', description: 'Cadena tipo Vénus de 50cm en acabado dorado premium.', isFeatured: true, isNew: false, isOnSale: false, salesCount: 44 },

  // Dijes
  { code: 'FAM-DI001', name: 'Dije Rosa Esmalte', categoryId: 'dijes', price: 4.50, stock: 30, material: 'Aleación + esmalte', weight: '3g', dimensions: '1.5cm', color: 'Rosa', description: 'Dije de rosa con esmalte de alta calidad. Ideal para collares y pulseras.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 60 },

  // Broches
  { code: 'FAM-BR001', name: 'Broche Mariposa Cristal', categoryId: 'broches', price: 9.00, stock: 12, material: 'Aleación + cristal', weight: '8g', dimensions: '4cm', color: 'Multicolor', description: 'Hermoso broche de mariposa con cristales de colores.', isFeatured: false, isNew: true, isOnSale: false },

  // Accesorios para cabello
  { code: 'FAM-AC001', name: 'Set Horquillas Perla', categoryId: 'accesorios-cabello', price: 5.00, stock: 25, material: 'Metal + perla sintética', weight: '6g', dimensions: '6cm', color: 'Dorado', description: 'Set de 6 horquillas con terminación en perla sintética.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 35 },
  { code: 'FAM-AC002', name: 'Diadema Cristal Brillante', categoryId: 'accesorios-cabello', price: 8.00, stock: 10, material: 'Metal + cristal', weight: '12g', dimensions: 'Ajustable', color: 'Plateado', description: 'Diadema con incrustaciones de cristal brillante. Perfecta para eventos.', isFeatured: true, isNew: true, isOnSale: false },

  // Llaveros
  { code: 'FAM-LL001', name: 'Llavero Corazón Initial', categoryId: 'llaveros', price: 3.50, stock: 40, material: 'Acero inoxidable', weight: '10g', dimensions: '3cm', color: 'Plateado', description: 'Llavero de corazón con inicial grabable en acero inoxidable.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 72 },

  // Bolsos
  { code: 'FAM-BO001', name: 'Bolso Crossbody Mini', categoryId: 'bolsos', price: 22.00, stock: 8, material: 'PU premium + cadena', weight: '200g', dimensions: '18x14x6cm', color: 'Negro', description: 'Mini bolso crossbody con cadena dorada. Tendencia de moda.', isFeatured: true, isNew: true, isOnSale: false },
  { code: 'FAM-BO002', name: 'Clutch Noche Dorada', categoryId: 'bolsos', price: 18.00, stock: 0, material: 'Satén + cristales', weight: '150g', dimensions: '25x15cm', color: 'Dorado', description: 'Clutch de noche con acabado en satén dorado y cristales.', isFeatured: false, isNew: false, isOnSale: false, status: 'out_of_stock', salesCount: 19 },

  // Cosméticos
  { code: 'FAM-CS001', name: 'Set Brochas Maquillaje', categoryId: 'cosmeticos', price: 12.00, stock: 15, material: 'Fibra sintética + madera', weight: '80g', dimensions: '12 piezas', color: 'Rosa', description: 'Set profesional de 12 brochas para maquillaje con estuche.', isFeatured: false, isNew: true, isOnSale: false },
  { code: 'FAM-CS002', name: 'Espejo LED Plegable', categoryId: 'cosmeticos', price: 9.00, stock: 20, material: 'ABS + LED', weight: '120g', dimensions: '12x8cm', color: 'Blanco', description: 'Espejo plegable con iluminación LED. Perfecto para el bolso.', isFeatured: false, isNew: false, isOnSale: true, salesCount: 33 },
]

const REVIEWS = [
  { author: 'María González', text: '¡Me encantó la calidad de los aretes! Llegaron perfectos y el envío fue super rápido. 100% recomendado.', rating: 5 },
  { author: 'Carolina López', text: 'Las pulseras son hermosas, se ven mucho más caras de lo que cuestan. Ya es mi tercera compra.', rating: 5 },
  { author: 'Ana Martínez', text: 'Excelente atención por WhatsApp. Me ayudaron a elegir el regalo perfecto para mi mamá.', rating: 5 },
  { author: 'Sofía Ramírez', text: 'La calidad es impresionante para el precio. Los collares son hermosos y duraderos.', rating: 4 },
  { author: 'Valentina Torres', text: 'Compré el set de brochas y estoy encantada. Calidad profesional a un precio accesible.', rating: 5 },
  { author: 'Isabella Herrera', text: 'Los anillos son hermosos, me encantó el diseño de serpiente. Mis amigas también quieren uno.', rating: 5 },
]

async function main() {
  console.log('🌱 Seeding database...')

  // Create categories
  const categoryMap: Record<string, string> = {}
  for (const cat of CATEGORIES) {
    const created = await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, order: cat.order },
      create: cat,
    })
    categoryMap[cat.slug] = created.id
    console.log(`  ✓ Category: ${cat.name}`)
  }

  // Create products
  for (const p of PRODUCTS) {
    const categoryId = categoryMap[p.categoryId]
    if (!categoryId) continue
    const status = (p as any).status || 'available'
    await db.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        categoryId,
        material: p.material,
        weight: p.weight,
        dimensions: p.dimensions,
        color: p.color,
        price: p.price,
        stock: p.stock,
        status,
        mainImage: '',
        images: '[]',
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        isOnSale: p.isOnSale,
        salesCount: (p as any).salesCount || 0,
      },
    })
    console.log(`  ✓ Product: ${p.code} - ${p.name}`)
  }

  // Create reviews
  for (const r of REVIEWS) {
    await db.review.create({ data: r })
    console.log(`  ✓ Review: ${r.author}`)
  }

  // Create admin user
  const adminPass = await hashPassword('luisabjorn')
  await db.adminUser.deleteMany({
    where: { username: { not: 'luisa' } },
  })
  await db.adminUser.upsert({
    where: { username: 'luisa' },
    update: {
      password: adminPass,
      name: 'Luisa',
    },
    create: {
      username: 'luisa',
      password: adminPass,
      name: 'Luisa',
    },
  })
  console.log('  ✓ Admin user created')

  console.log('✅ Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
