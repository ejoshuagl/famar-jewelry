import { NextRequest, NextResponse } from 'next/server'
import { calculateDiscount } from '@/lib/commerce'
import { getSaleDiscount } from '@/lib/commerce'
import { salePrice } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const eligibleSubtotal = Number(body.eligibleSubtotal ?? body.subtotal)
  const saleBaseSubtotal = Number(body.saleBaseSubtotal || 0)
  const suppliedSaleSubtotal = Number(body.saleSubtotal)
  if (!Number.isFinite(eligibleSubtotal) || eligibleSubtotal < 0 || !Number.isFinite(saleBaseSubtotal) || saleBaseSubtotal < 0) {
    return NextResponse.json({ error: 'Subtotal inválido' }, { status: 400 })
  }
  const saleDiscount = await getSaleDiscount()
  const saleSubtotal = Number.isFinite(suppliedSaleSubtotal) && suppliedSaleSubtotal >= 0
    ? suppliedSaleSubtotal
    : salePrice(saleBaseSubtotal, saleBaseSubtotal > 0, saleDiscount)
  const result = await calculateDiscount(eligibleSubtotal, String(body.code || ''), saleSubtotal)
  if (body.code && !result.validCoupon) {
    return NextResponse.json({ ...result, saleDiscount, couponError: 'Cupón inválido, vencido o no cumple el mínimo de compra sin contar productos en oferta' })
  }
  return NextResponse.json({ ...result, saleDiscount })
}
