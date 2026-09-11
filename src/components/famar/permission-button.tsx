'use client'

import { Button as BaseButton } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import type { ComponentProps } from 'react'

export function Button({ permission, ...props }: ComponentProps<typeof BaseButton> & { permission?: string }) {
  const can = useAuthStore((state) => state.can)
  if (permission && !can(permission)) return null
  return <BaseButton {...props} />
}
