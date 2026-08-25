'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { ProductCard, type ProductData, ProductCardSkeleton } from './product-card'
import { CategoryChips } from './category-chips'
import { PaginationControls } from './pagination-controls'
import { SearchBar } from './search-bar'
import { SkeletonGrid } from './skeleton-grid'
import { EmptyState } from './empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal, X } from 'lucide-react'

export function CatalogView() {
  const { searchQuery, selectedCategory, catalogFilter, campaignFilter, setCategory, setCatalogFilter, setCampaignFilter, setSearch } = useAppStore()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('relevance')
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const filterLabels: Record<string, string> = {
    featured: 'Destacados',
    new: 'Nuevos ingresos',
    'best-selling': 'Más vendidos',
    sale: 'En oferta',
  }

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (localSearch) params.set('search', localSearch)
    if (selectedCategory) params.set('category', selectedCategory)
    if (catalogFilter === 'featured') params.set('featured', 'true')
    if (catalogFilter === 'new') params.set('new', 'true')
    if (catalogFilter === 'sale') params.set('sale', 'true')
    if (campaignFilter) params.set('campaign', campaignFilter.id)
    params.set('sort', catalogFilter === 'best-selling' ? 'best-selling' : sort)
    params.set('page', page.toString())
    params.set('limit', '12')
    return params.toString()
  }, [localSearch, selectedCategory, catalogFilter, campaignFilter, sort, page])

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'catalog', localSearch, selectedCategory, catalogFilter, campaignFilter?.id, sort, page],
    queryFn: async () => {
      const res = await fetch(`/api/products?${buildQuery()}`)
      return res.json()
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      return res.json()
    },
  })

  const products = (data?.products || []) as ProductData[]
  const totalPages = data?.totalPages || 1

  const handleCategorySelect = (slug: string | null) => {
    setPage(1)
    setCategory(slug)
  }

  const handleSearch = (q: string) => {
    setPage(1)
    setLocalSearch(q)
    setSearch(q)
  }

  const clearFilters = () => {
    setLocalSearch('')
    setSearch('')
    setCategory(null)
    setCatalogFilter(null)
    setCampaignFilter(null)
    setSort('relevance')
    setPage(1)
  }

  const hasFilters = localSearch || selectedCategory || catalogFilter || campaignFilter || sort !== 'relevance'

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Catálogo</h1>
        <p className="text-sm text-muted-foreground">
          Explora nuestra colección completa
        </p>
      </div>

      {/* Search */}
      <SearchBar onSearch={handleSearch} />

      {/* Category Chips */}
      {categories && (
        <CategoryChips
          categories={categories}
          selected={selectedCategory}
          onSelect={handleCategorySelect}
        />
      )}

      {/* Active collection filter (from home sections) */}
      {catalogFilter === 'best-selling' && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary/40 text-primary"
            onClick={() => { setPage(1); setCatalogFilter(null) }}
          >
            {filterLabels[catalogFilter]}
            <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Quick filters */}
      {campaignFilter && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Colección de campaña</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-primary">{campaignFilter.title}</p>
            <Button size="sm" variant="ghost" onClick={() => { setPage(1); setCampaignFilter(null) }}>
              <X className="mr-1 h-3.5 w-3.5" />Quitar
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['featured', 'Destacados'],
          ['new', 'Nuevos'],
          ['sale', 'En Oferta'],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            variant={catalogFilter === value ? 'default' : 'outline'}
            size="sm"
            className={catalogFilter === value ? 'bg-primary text-primary-foreground' : 'border-primary/40 text-primary hover:bg-primary/10'}
            onClick={() => { setPage(1); setCampaignFilter(null); setCatalogFilter(catalogFilter === value ? null : value) }}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Sort and filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={sort} onValueChange={(value) => { setPage(1); setSort(value) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevancia</SelectItem>
              <SelectItem value="price-asc">Precio: menor a mayor</SelectItem>
              <SelectItem value="price-desc">Precio: mayor a menor</SelectItem>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="best-selling">Más vendidos</SelectItem>
              <SelectItem value="name">Nombre A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-3">
            {!isLoading && data && (
              <p className="text-sm text-muted-foreground">
                {data.total} resultado{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </Button>
          </div>
        )}

      </div>

      {/* Products */}
      {isLoading ? (
        <SkeletonGrid count={12} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No se encontraron productos"
          description={
            hasFilters
              ? 'Intenta cambiar los filtros de búsqueda o categoría.'
              : 'Aún no hay productos disponibles.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
