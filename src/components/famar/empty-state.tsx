'use client'

import { motion } from 'framer-motion'
import { PackageSearch } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 text-muted-foreground">
        {icon || <PackageSearch className="h-16 w-16" />}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-md mb-4">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  )
}