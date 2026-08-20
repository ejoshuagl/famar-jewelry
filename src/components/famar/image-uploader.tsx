'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { convertDriveUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ImageUploaderProps {
  label: string
  hint?: string
  value?: string
  values?: string[]
  multiple?: boolean
  onChange: (next: string | string[]) => void
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
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preparing, setPreparing] = useState(false)
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
    </div>
  )
}
