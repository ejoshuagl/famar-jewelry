'use client'

import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SALE_DISCOUNT } from '@/lib/pricing'

export function usePricingSettings() {
  const query = useQuery({
    queryKey: ['commerce-settings'],
    queryFn: async () => {
      const response = await fetch('/api/commerce-settings')
      if (!response.ok) throw new Error('No se pudo cargar la configuración de precios')
      return response.json() as Promise<{ saleDiscount: number }>
    },
    staleTime: 5 * 60 * 1000,
  })

  return { ...query, saleDiscount: Number(query.data?.saleDiscount ?? DEFAULT_SALE_DISCOUNT) }
}
