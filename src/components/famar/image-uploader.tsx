'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { convertDriveUrl } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ImageUploaderProps {
  label: string
  hint?: string
  value?: string
  values?: string[]
  multiple?: boolean
  duplicateCheck?: boolean
  excludeProductId?: string | null
  onDuplicateSelect?: (productId: string) => void
  onChange: (next: string | string[]) => void
}

interface DuplicateMatch {
  id: string
  name: string
  code: string
  mainImage?: string | null
  category: string
  similarity: number
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function compressImage(file: File, maxSize = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('No se pudo procesar la imagen'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = objectUrl
  })
}

export function ImageUploader({
  label,
  hint,
  value = '',
  values,
  multiple = false,
  duplicateCheck = false,
  excludeProductId,
  onDuplicateSelect,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preparing, setPreparing] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const images = multiple ? values || [] : value ? [value] : []

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setPreparing(true)
    try {
      const prepared: string[] = []
      for (const file of Array.from(files)) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error('Formato no permitido. Usa JPG, PNG, WEBP o GIF.')
        }
        prepared.push(await compressImage(file))
      }
      if (multiple) {
        onChange([...images, ...prepared])
      } else {
        onChange(prepared[0])
        if (duplicateCheck) {
          setCheckingDuplicates(true)
          setDuplicateMatches([])
          try {
            const response = await fetch('/api/products/image-similarity', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-token': useAuthStore.getState().token || '',
              },
              body: JSON.stringify({
                image: prepared[0],
                excludeProductId: excludeProductId || undefined,
              }),
            })
            if (!response.ok) throw new Error('No se pudo validar la imagen')
            const result = await response.json()
            setDuplicateMatches(result.matches || [])
          } catch {
            toast.error('La foto quedó lista, pero no se pudo comprobar si está duplicada.')
          } finally {
            setCheckingDuplicates(false)
          }
        }
      }
      toast.success('Foto lista. Se guardará al crear o actualizar el producto.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al preparar la imagen')
    } finally {
      setPreparing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeAt = (index: number) => {
    if (multiple) {
      onChange(images.filter((_, i) => i !== index))
    } else {
      onChange('')
    }
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap gap-3">
        {images.map((url, index) => (
          <div
            key={`${url.slice(0, 48)}-${index}`}
            className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted"
          >
            <img
              src={convertDriveUrl(url)}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-destructive shadow"
              aria-label="Quitar imagen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {(multiple || images.length === 0) && (
          <Button
            type="button"
            variant="outline"
            className="h-24 w-24 flex-col gap-1 text-muted-foreground"
            disabled={preparing}
            onClick={() => inputRef.current?.click()}
          >
            {preparing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-[11px]">
              {preparing ? 'Preparando...' : 'Seleccionar'}
            </span>
          </Button>
        )}
      </div>
      {checkingDuplicates && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Comparando con las imágenes del catálogo…
        </div>
      )}
      {!checkingDuplicates && duplicateMatches.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Esta imagen se parece a productos existentes</p>
              <p className="text-xs text-muted-foreground">
                Revisa las coincidencias antes de crear una ficha duplicada.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {duplicateMatches.map((match) => (
              <div key={match.id} className="flex items-center gap-3 rounded-md border bg-background/80 p-2">
                <button
                  type="button"
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted transition hover:border-primary hover:ring-2 hover:ring-primary/20"
                  onClick={() => match.mainImage && setZoomImage(convertDriveUrl(match.mainImage))}
                  disabled={!match.mainImage}
                  aria-label={`Ampliar imagen de ${match.name}`}
                >
                  {match.mainImage ? (
                    <img
                      src={convertDriveUrl(match.mainImage)}
                      alt={match.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{match.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {match.code} · {match.category}
                  </p>
                  <p className="text-xs font-semibold text-amber-500">
                    {match.similarity}% de similitud
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => onDuplicateSelect?.(match.id)}
                >
                  Abrir
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDuplicateMatches([])}
          >
            Es un producto nuevo, continuar
          </Button>
        </div>
      )}
      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background/95 border-primary/30">
          <DialogTitle className="sr-only">Imagen ampliada del producto semejante</DialogTitle>
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Producto semejante ampliado"
              className="w-full max-h-[82vh] object-contain bg-black/40 cursor-zoom-out"
              onClick={() => setZoomImage(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
