'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { AdminLayout } from './admin-layout'
import { slugify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Trash2,
  Loader2,
  Tags,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminCategoriesView() {
  const { adminName } = useAuthStore()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories-all'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name required')
      const slug = slugify(name)
      // Get max order
      const currentCats = categories || []
      const maxOrder = currentCats.reduce((max: number, cat: { order: number }) => Math.max(max, cat.order || 0), 0)

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': adminName || '',
        },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          order: maxOrder + 1,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error creating category')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories-all'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoría creada')
      closeCreateDialog()
    },
    onError: (err) => toast.error(err.message || 'Error al crear la categoría'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingId) return
      const res = await fetch(`/api/categories/${deletingId}`, {
        method: 'DELETE',
        headers: { 'x-admin-name': adminName || '' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error deleting category')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories-all'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoría eliminada')
      setDeleteDialogOpen(false)
      setDeletingId(null)
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar la categoría'),
  })

  const closeCreateDialog = () => {
    setCreateDialogOpen(false)
    setName('')
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Categorías</h1>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !categories || categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay categorías
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat: { id: string; name: string; slug: string; order: number; active: boolean; _count?: { products: number } }) => (
                    <TableRow key={cat.id}>
                      <TableCell className="text-sm text-muted-foreground">{cat.order}</TableCell>
                      <TableCell className="font-medium text-sm">{cat.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cat.slug}</TableCell>
                      <TableCell className="text-sm">{cat._count?.products || 0}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          cat.active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {cat.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={(cat._count?.products || 0) > 0}
                          onClick={() => {
                            setDeletingId(cat.id)
                            setDeleteDialogOpen(true)
                          }}
                          title={(cat._count?.products || 0) > 0 ? 'No se puede eliminar con productos' : 'Eliminar'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nueva Categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Collares"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createMutation.mutate()
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Slug: {slugify(name || '...')}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeCreateDialog}>Cancelar</Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !name.trim()}
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>
                  ) : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  )
}