import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const reviews = await db.review.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(reviews)
  } catch (error) {
    console.error('GET /api/reviews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}