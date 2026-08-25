import { NextRequest, NextResponse } from 'next/server'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import { getSiteTheme, setSiteTheme, type SiteTheme } from '@/lib/site-theme'

export async function GET() {
  try {
    return NextResponse.json({ theme: await getSiteTheme() })
  } catch (error) {
    console.error('GET /api/theme error:', error)
    return NextResponse.json({ theme: 'standard' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await request.json()
    const theme: SiteTheme = body.theme === 'christmas' ? 'christmas' : 'standard'
    await setSiteTheme(theme)
    await auditLog({ action: 'update', entity: 'theme', admin: admin.name, details: theme })
    return NextResponse.json({ theme })
  } catch (error) {
    console.error('POST /api/theme error:', error)
    return NextResponse.json({ error: 'No se pudo guardar el tema' }, { status: 500 })
  }
}
