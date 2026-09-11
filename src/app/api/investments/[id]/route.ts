import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLog, requireAdmin } from '@/lib/admin-auth'

function finiteMoney(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(`${value}T05:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, 'investments')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.investment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Inversión no encontrada' }, { status: 404 })

  const body = await request.json()
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 120) : ''
  const merchandise = finiteMoney(body.merchandise)
  const taxes = finiteMoney(body.taxes)
  const purchasedAt = validDate(body.purchasedAt)
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null
  if (!description || merchandise === null || taxes === null || !purchasedAt || merchandise + taxes <= 0) {
    return NextResponse.json({ error: 'Completa correctamente la compra, los valores y la fecha' }, { status: 400 })
  }
  const total = Math.round((merchandise + taxes) * 100) / 100
  const investment = await db.investment.update({ where: { id }, data: { description, merchandise, taxes, total, purchasedAt, notes } })
  await auditLog({ action: 'update', entity: 'investment', entityId: id, admin: admin.name, details: `${description} — $${total.toFixed(2)}` })
  return NextResponse.json(investment)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, 'investments')
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.investment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Inversión no encontrada' }, { status: 404 })
  await db.investment.delete({ where: { id } })
  await auditLog({ action: 'delete', entity: 'investment', entityId: id, admin: admin.name, details: `${existing.description} — $${existing.total.toFixed(2)}` })
  return NextResponse.json({ success: true })
}
