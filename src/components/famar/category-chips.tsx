'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { motion } from 'framer-motion'

interface Category {
  id: string
  name: string
  slug: string
  _count?: { products: number }
}

interface CategoryChipsProps {
  categories: Category[]
  selected: string | null
  onSelect: (slug: string | null) => void
}

export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  const { navigate, setSearch } = useAppStore()

  const handleSelect = (slug: string | null) => {
    onSelect(slug)
    if (slug) {
      navigate('catalog')
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <Button
        variant={selected === null ? 'default' : 'outline'}
        size="sm"
        className={cn(
          'shrink-0 rounded-full text-xs',
          selected === null
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border-primary/30 text-foreground hover:bg-primary/10'
        )}
        onClick={() => handleSelect(null)}
      >
        Todos
      </Button>
      {categories.map((cat) => (
        <motion.div
          key={cat.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant={selected === cat.slug ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'shrink-0 rounded-full text-xs',
              selected === cat.slug
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-primary/30 text-foreground hover:bg-primary/10'
            )}
            onClick={() => handleSelect(cat.slug)}
          >
            {cat.name}
          </Button>
        </motion.div>
      ))}
    </div>
  )
}
