'use client'

import { useState } from 'react'
import { cn, convertDriveUrl } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface ProductGalleryProps {
  mainImage?: string | null
  images?: string | null
  productName: string
}

export function ProductGallery({ mainImage, images, productName }: ProductGalleryProps) {
  let imageList: string[] = []
  if (images) {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) {
        imageList = parsed.map((url: string) => convertDriveUrl(url))
      }
    } catch {
      // ignore
    }
  }
  if (mainImage && !imageList.includes(convertDriveUrl(mainImage))) {
    imageList.unshift(convertDriveUrl(mainImage))
  }
  if (imageList.length === 0) {
    imageList = ['placeholder']
  }

  const [current, setCurrent] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const hasRealImages = imageList[0] !== 'placeholder'

  const prev = () => setCurrent((c) => (c === 0 ? imageList.length - 1 : c - 1))
  const next = () => setCurrent((c) => (c === imageList.length - 1 ? 0 : c + 1))

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div
        className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-zoom-in"
        onClick={() => hasRealImages && setZoomed(true)}
      >
        {hasRealImages ? (
          <motion.img
            key={current}
            src={imageList[current]}
            alt={`${productName} - ${current + 1}`}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 dark:from-primary/30 dark:via-primary/15 dark:to-primary/5">
            <span className="text-7xl font-bold text-primary/30">
              {productName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {imageList.length > 1 && hasRealImages && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 dark:bg-black/60 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 dark:bg-black/60 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {hasRealImages && (
          <div className="absolute bottom-2 right-2">
            <div className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <ZoomIn className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {imageList.length > 1 && hasRealImages && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imageList.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={cn(
                'shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors',
                current === idx
                  ? 'border-primary'
                  : 'border-transparent hover:border-primary/50'
              )}
            >
              <img
                src={img}
                alt={`${productName} thumb ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Dialog */}
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <DialogTitle className="sr-only">{productName}</DialogTitle>
          <div className="relative">
            <motion.img
              key={current}
              src={imageList[current]}
              alt={`${productName} - ${current + 1}`}
              className="w-full max-h-[80vh] object-contain"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            />
            {imageList.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/20 hover:bg-white/30 border-none"
                  onClick={prev}
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-white/20 hover:bg-white/30 border-none"
                  onClick={next}
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </Button>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {current + 1} / {imageList.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}