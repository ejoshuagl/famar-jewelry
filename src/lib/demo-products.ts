import type { ProductData } from '@/components/famar/product-card'

export const DEMO_CATEGORIES = [
  { id: 'demo-cat-aretes', name: 'Aretes', slug: 'aretes', _count: { products: 2 } },
  { id: 'demo-cat-collares', name: 'Collares', slug: 'collares', _count: { products: 2 } },
  { id: 'demo-cat-pulseras', name: 'Pulseras', slug: 'pulseras', _count: { products: 2 } },
  { id: 'demo-cat-anillos', name: 'Anillos', slug: 'anillos', _count: { products: 2 } },
]

export const DEMO_PRODUCTS: ProductData[] = [
  {
    id: 'demo-ar-047',
    code: 'FAM-AR047',
    name: 'Aretes Aros Dorados',
    price: 8,
    stock: 6,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtkyc5ca0002jl04oha6cfww/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Aretes', slug: 'aretes' },
    isFeatured: true,
    isOnSale: true,
  },
  {
    id: 'demo-co-005',
    code: 'FAM-CO005',
    name: 'Collar Corazón Esencial',
    price: 10,
    stock: 4,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtl3gfl30001jv044hengwr4/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Collares', slug: 'collares' },
    isFeatured: true,
    isNew: true,
  },
  {
    id: 'demo-pu-018',
    code: 'FAM-PU018',
    name: 'Pulsera Destellos',
    price: 7,
    stock: 3,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtl2pca6000hl505z34bdo2v/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Pulseras', slug: 'pulseras' },
    isFeatured: true,
    isOnSale: true,
  },
  {
    id: 'demo-an-068',
    code: 'FAM-AN068',
    name: 'Anillo Luz Eterna',
    price: 6,
    stock: 5,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmt7tcx3p003jju04stel373q/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Anillos', slug: 'anillos' },
    isNew: true,
    isOnSale: true,
  },
  {
    id: 'demo-co-021',
    code: 'FAM-CO021',
    name: 'Collar Brillo Nocturno',
    price: 9,
    stock: 7,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtl2o1m0000el505y8xdo7am/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Collares', slug: 'collares' },
    isNew: true,
  },
  {
    id: 'demo-an-052',
    code: 'FAM-AN052',
    name: 'Anillo Corazones Plata',
    price: 7.5,
    stock: 2,
    status: 'available',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtl0u69c0004l4043vl3lcip/thumbnail?thumbnailVersion=2&v=1789512044171',
    category: { name: 'Anillos', slug: 'anillos' },
    isFeatured: true,
    isOnSale: true,
  },
  {
    id: 'demo-ar-032',
    code: 'FAM-AR032',
    name: 'Aretes Luna Dorada',
    price: 6.5,
    stock: 0,
    status: 'out_of_stock',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmt7tcv31003gju047kt45azz/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Aretes', slug: 'aretes' },
  },
  {
    id: 'demo-pu-011',
    code: 'FAM-PU011',
    name: 'Pulsera Encanto Clásico',
    price: 8.5,
    stock: 0,
    status: 'out_of_stock',
    mainImage: 'https://famar-jewelry.vercel.app/api/products/cmtl2lsh00004l604uh45mah5/thumbnail?thumbnailVersion=2&v=1789080200566',
    category: { name: 'Pulseras', slug: 'pulseras' },
  },
]

export const demoHomeProducts = {
  featuredProducts: DEMO_PRODUCTS.filter((product) => product.status === 'available' && product.isFeatured).slice(0, 4),
  newProducts: DEMO_PRODUCTS.filter((product) => product.status === 'available' && product.isNew).slice(0, 4),
  offers: DEMO_PRODUCTS.filter((product) => product.status === 'available' && product.isOnSale).slice(0, 4),
}

export function getDemoCatalogProducts(options: {
  category?: string | null
  search?: string
  filter?: string | null
} = {}) {
  const search = options.search?.trim().toLocaleLowerCase('es')
  return DEMO_PRODUCTS.filter((product) => product.status === 'available')
    .filter((product) => !options.category || product.category?.slug === options.category)
    .filter((product) => !search || `${product.name} ${product.code}`.toLocaleLowerCase('es').includes(search))
    .filter((product) => {
      if (options.filter === 'featured') return product.isFeatured
      if (options.filter === 'new') return product.isNew
      if (options.filter === 'sale') return product.isOnSale
      if (options.filter === 'men') return product.isForMen
      return true
    })
}

export function getDemoOutOfStockProducts(category?: string | null) {
  return DEMO_PRODUCTS.filter((product) => product.status === 'out_of_stock')
    .filter((product) => !category || product.category?.slug === category)
}
