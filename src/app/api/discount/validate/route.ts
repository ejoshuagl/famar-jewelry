import { NextRequest, NextResponse } from 'next/server'
import { calculateDiscount } from '@/lib/commerce'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const subtotal = Number(body.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) return NextResponse.json({ error: 'Subtotal inválido' }, { status: 400 })
  const result = await calculateDiscount(subtotal, String(body.code || ''))
  if (body.code && !result.coupon && result.source !== `Cupón ${String(body.code).trim().toUpperCase()}`) {
    return NextResponse.json({ ...result, couponError: 'Cupón inválido, vencido o no cumple el mínimo de compra' })
  }
  return NextResponse.json(result)
}
