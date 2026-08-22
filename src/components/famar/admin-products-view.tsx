'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Package,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { ImageUploader } from './image-uploader'

interface ProductForm {
  name: string
  code: string
  description: string
  categoryId: string
  material: string
  weight: string
  dimensions: string
  color: string
  price: string
  stock: string
  status: string
  mainImage: string
  galleryUrls: string
  isFeatured: boolean
  isNew: boolean
  isOnSale: boolean
  visible: boolean
}

const emptyForm: ProductForm = {
  name: '', code: '', description: '', categoryId: '',
  material: '', weight: '', dimensions: '', color: '',
  price: '', stock: '0', status: 'available', mainImage: '',
  galleryUrls: '', isFeatured: false, isNew: false, isOnSale: false,
  visible: true,
}

function ProductMobileCard({ product, onEdit, onDelete, onToggleVisible, checked, onToggleCheck }: {
  product: Record<string, unknown>
  onEdit: (p: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onToggleVisible: (p: { id: string; visible: boolean }) => void
  checked: boolean
  onToggleCheck: (id: string) => void
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggleCheck(product.id as string)}
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.code}</p>
          </div>
        </div>
        <Badge
          variant={product.status === 'available' ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 shrink-0"
        >
          {product.status === 'available' ? 'Disponible' : 'Agotado'}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {product.isFeatured && <Badge variant="default" className="text-[10px] px-1 py-0">Destacado</Badge>}
        {product.isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">Nuevo</Badge>}
        {product.isOnSale && <Badge variant="destructive" className="text-[10px] px-1 py-0">Oferta</Badge>}
        {product.visible === false && <Badge variant="outline" className="text-[10px] px-1 py-0">Oculto</Badge>}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm">
          <span className="font-bold">{formatPrice(product.price as number)}</span>
          <span className="text-muted-foreground ml-2">Stock: {product.stock}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onToggleVisible(product as { id: string; visible: boolean })}
          >
            {product.visible === false ? (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => onDelete(product.id as string)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function AdminProductsView() {
  const { adminName } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [flagFilter, setFlagFilter] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBadge, setBulkBadge] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', search, flagFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
        page: page.toString(),
        all: 'true',
      })
      if (search) params.set('search', search)
      if (flagFilter) params.set('flag', flagFilter)
      const res = await fetch(`/api/products?${params}`, { cache: 'no-store' })
      return res.json()
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      return res.json()
    },
  })

  const products = data?.products || []
  const totalPages = data?.totalPages || 1

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        images: form.galleryUrls
          ? form.galleryUrls.split('\n').filter((u) => u.trim())
          : [],
      }

      if (editingId) {
        const res = await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-name': adminName || '',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Error updating product')
        return res.json()
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-name': adminName || '',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Error creating product')
        return res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(editingId ? 'Producto actualizado' : 'Producto creado')
      closeDialog()
    },
    onError: () => {
      toast.error('Error al guardar el producto')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingId) return
      const res = await fetch(`/api/products/${deletingId}`, {
        method: 'DELETE',
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) throw new Error('Error deleting product')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success('Producto eliminado')
      setDeleteDialogOpen(false)
      setDeletingId(null)
    },
    onError: () => {
      toast.error('Error al eliminar el producto')
    },
  })

  const toggleVisibleMutation = useMutation({
    mutationFn: async (product: { id: string; visible: boolean }) => {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({ visible: !product.visible }),
      })
      if (!res.ok) throw new Error('Error toggling visibility')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: async (payload: {
      setVisible?: boolean
      setFeatured?: boolean
      setIsNew?: boolean
      setIsOnSale?: boolean
    }) => {
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({ ids: Array.from(selected), ...payload }),
      })
      if (!res.ok) throw new Error('Error updating products')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(`${data.updated} producto(s) actualizado(s)`)
      setSelected(new Set())
    },
    onError: () => {
      toast.error('Error al actualizar los productos')
    },
  })

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyBulkBadge = () => {
    const actions: Record<string, () => void> = {
      'featured-on': () => bulkMutation.mutate({ setFeatured: true }),
      'featured-off': () => bulkMutation.mutate({ setFeatured: false }),
      'new-on': () => bulkMutation.mutate({ setIsNew: true }),
      'new-off': () => bulkMutation.mutate({ setIsNew: false }),
      'sale-on': () => bulkMutation.mutate({ setIsOnSale: true }),
      'sale-off': () => bulkMutation.mutate({ setIsOnSale: false }),
    }
    if (actions[bulkBadge]) {
      actions[bulkBadge]()
      setBulkBadge('')
    }
  }

  const allOnPageSelected = products.length > 0 && products.every((p: { id: string }) => selected.has(p.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allOnPageSelected) {
        return new Set(Array.from(prev).filter((id) => !products.some((p: { id: string }) => p.id === id)))
      }
      const next = new Set(prev)
      products.forEach((p: { id: string }) => next.add(p.id))
      return next
    })
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setEditDialogOpen(true)
  }

  const openEdit = (product: Record<string, unknown>) => {
    setEditingId(product.id as string)
    let imagesStr = ''
    if (product.images) {
      try {
        const imgs = JSON.parse(product.images as string)
        imagesStr = (imgs as string[]).join('\n')
      } catch {
        imagesStr = product.images as string
      }
    }
    setForm({
      name: product.name as string,
      code: product.code as string,
      description: (product.description as string) || '',
      categoryId: product.categoryId as string,
      material: (product.material as string) || '',
      weight: (product.weight as string) || '',
      dimensions: (product.dimensions as string) || '',
      color: (product.color as string) || '',
      price: String(product.price),
      stock: String(product.stock),
      status: product.status as string,
      mainImage: (product.mainImage as string) || '',
      galleryUrls: imagesStr,
      isFeatured: product.isFeatured as boolean,
      isNew: product.isNew as boolean,
      isOnSale: product.isOnSale as boolean,
      visible: product.visible !== false,
    })
    setEditDialogOpen(true)
  }

  const closeDialog = () => {
    setEditDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const updateForm = (key: keyof ProductForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Productos</h1>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código, material, color..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={flagFilter || 'todos'} onValueChange={(v) => { setFlagFilter(v === 'todos' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="featured">Destacados</SelectItem>
              <SelectItem value="new">Nuevos</SelectItem>
              <SelectItem value="sale">En Oferta</SelectItem>
              <SelectItem value="out_of_stock">Agotados</SelectItem>
              <SelectItem value="hidden">Ocultos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <Card>
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">{selected.size} seleccionado(s)</span>
              <div className="flex items-center gap-2">
                <Select value={bulkBadge} onValueChange={setBulkBadge}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Destacado / Nuevo / Oferta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured-on">Marcar como Destacado</SelectItem>
                    <SelectItem value="featured-off">Quitar Destacado</SelectItem>
                    <SelectItem value="new-on">Marcar como Nuevo</SelectItem>
                    <SelectItem value="new-off">Quitar Nuevo</SelectItem>
                    <SelectItem value="sale-on">Marcar En Oferta</SelectItem>
                    <SelectItem value="sale-off">Quitar En Oferta</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={applyBulkBadge} disabled={!bulkBadge || bulkMutation.isPending}>
                  Aplicar
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate({ setVisible: true })} disabled={bulkMutation.isPending}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Mostrar
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate({ setVisible: false })} disabled={bulkMutation.isPending}>
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                  Ocultar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Desktop Table */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: Record<string, unknown>, idx: number) => {
                    const cat = product.category as { name: string } | null
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(product.id as string)}
                            onCheckedChange={() => toggleSelected(product.id as string)}
                            aria-label="Seleccionar producto"
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(page - 1) * 20 + idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[200px]">{product.name}</p>
                            <div className="flex gap-1 mt-1">
                              {product.isFeatured && <Badge variant="default" className="text-[10px] px-1 py-0">Destacado</Badge>}
                              {product.isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">Nuevo</Badge>}
                              {product.isOnSale && <Badge variant="destructive" className="text-[10px] px-1 py-0">Oferta</Badge>}
                              {product.visible === false && <Badge variant="outline" className="text-[10px] px-1 py-0">Oculto</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{product.code}</TableCell>
                        <TableCell className="text-sm">{cat?.name || '-'}</TableCell>
                        <TableCell className="text-sm font-medium">{formatPrice(product.price as number)}</TableCell>
                        <TableCell className="text-sm">{product.stock}</TableCell>
                        <TableCell>
                          <Badge
                            variant={product.status === 'available' ? 'default' : 'secondary'}
                            className="text-xs"
                            title="El estado se calcula según el stock"
                          >
                            {product.status === 'available' ? 'Disponible' : 'Agotado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={product.visible === false ? 'Mostrar en la página' : 'Ocultar de la página'}
                              onClick={() => toggleVisibleMutation.mutate(product as { id: string; visible: boolean })}
                            >
                              {product.visible === false ? (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                setDeletingId(product.id as string)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="flex justify-between mt-3">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                </div>
              </Card>
            ))
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron productos
            </div>
          ) : (
            products.map((product: Record<string, unknown>) => (
              <ProductMobileCard
                key={product.id}
                product={product}
                onEdit={openEdit}
                onDelete={(id) => {
                  setDeletingId(id)
                  setDeleteDialogOpen(true)
                }}
                onToggleVisible={(p) => toggleVisibleMutation.mutate(p)}
                checked={selected.has(product.id as string)}
                onToggleCheck={toggleSelected}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                variant={page === i + 1 ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                </div>
                <div>
                  <Label>Código *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.code}
                      onChange={(e) => updateForm('code', e.target.value)}
                      readOnly={!!editingId}
                      className={editingId ? 'bg-muted' : ''}
                      placeholder="Se genera al seleccionar categoría"
                    />
                    {!editingId && form.categoryId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/products/next-code?categoryId=${form.categoryId}`)
                            const data = await res.json()
                            if (data.code) {
                              updateForm('code', data.code)
                            }
                          } catch {
                            toast.error('Error al generar código')
                          }
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={3} />
                </div>
                <div>
                  <Label>Categoría *</Label>
                  <Select value={form.categoryId} onValueChange={(v) => {
                    updateForm('categoryId', v)
                    // Auto-generate code when creating new product and category changes
                    if (!editingId) {
                      fetch(`/api/products/next-code?categoryId=${v}`)
                        .then((res) => res.json())
                        .then((data) => {
                          if (data.code) {
                            updateForm('code', data.code)
                          }
                        })
                        .catch((err) => console.error('Error generating code:', err))
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat: { id: string; name: string }) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Precio *</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => updateForm('price', e.target.value)} />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock} onChange={(e) => updateForm('stock', e.target.value)} />
                </div>
                <div>
                  <Label>Material</Label>
                  <Select value={form.material} onValueChange={(v) => updateForm('material', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Acero Inoxidable', 'Plata', 'Oro', 'Chapado en Oro', 'Aleación'].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      {form.material && !['Acero Inoxidable', 'Plata', 'Oro', 'Chapado en Oro', 'Aleación'].includes(form.material.trim()) && (
                        <SelectItem value={form.material}>{form.material}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Peso</Label>
                  <Input value={form.weight} onChange={(e) => updateForm('weight', e.target.value)} />
                </div>
                <div>
                  <Label>Dimensiones</Label>
                  <Input value={form.dimensions} onChange={(e) => updateForm('dimensions', e.target.value)} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input value={form.color} onChange={(e) => updateForm('color', e.target.value)} />
                </div>
                <ImageUploader
                  label="Imagen principal"
                  hint="Elige la foto aquí. Se previsualiza y se guarda en Supabase al crear o actualizar el producto."
                  value={form.mainImage}
                  onChange={(url) => updateForm('mainImage', url as string)}
                />
                <ImageUploader
                  label="Galería"
                  hint="Fotos extra. También se guardan al guardar el producto."
                  multiple
                  values={form.galleryUrls.split('\n').map((u) => u.trim()).filter(Boolean)}
                  onChange={(urls) => updateForm('galleryUrls', (urls as string[]).join('\n'))}
                />
                <div className="flex flex-col gap-3 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.isFeatured} onCheckedChange={(v) => updateForm('isFeatured', v)} />
                    <Label>Destacado</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.isNew} onCheckedChange={(v) => updateForm('isNew', v)} />
                    <Label>Nuevo</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.isOnSale} onCheckedChange={(v) => updateForm('isOnSale', v)} />
                    <Label>En Oferta</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.visible} onCheckedChange={(v) => updateForm('visible', v)} />
                    <Label>Visible en la página</Label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                ) : (
                  editingId ? 'Actualizar' : 'Crear'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El producto será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}