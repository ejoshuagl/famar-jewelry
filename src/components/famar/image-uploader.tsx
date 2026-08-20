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
  adminName: string | null
  value?: string
  values?: string[]
  multiple?: boolean
  onChange: (next: string | string[]) => void
}

async function uploadFile(file: File, adminName: string | null): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'x-admin-name': adminName || '' },
    body,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Error al subir la imagen')
  }
  return data.url as string
}

export function ImageUploader({
  label,
  hint,
  adminName,
  value = '',
  values,
  multiple = false,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const images = multiple ? values || [] : value ? [value] : []

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file, adminName))
      }
      if (multiple) {
        onChange([...images, ...uploaded])
      } else {
        onChange(uploaded[0])
      }
      toast.success(uploaded.length > 1 ? 'Imágenes subidas' : 'Imagen subida')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
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
            key={`${url}-${index}`}
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
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-[11px]">
              {uploading ? 'Subiendo...' : 'Seleccionar'}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
