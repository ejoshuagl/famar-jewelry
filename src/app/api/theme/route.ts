import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { auditLog, requireAdmin } from '@/lib/admin-auth'
import {
  getCachedSiteDesignTheme,
  getCachedSiteTheme,
  setSiteDesignTheme,
  setSiteTheme,
  type SiteDesignTheme,
  type SiteTheme,
} from '@/lib/site-theme'

export async function GET() {
  try {
    const [theme, designTheme] = await Promise.all([getCachedSiteTheme(), getCachedSiteDesignTheme()])
    return NextResponse.json({ theme, designTheme }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/theme error:', error)
    return NextResponse.json({ theme: 'standard', designTheme: 'original' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request, 'themes')
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await request.json()
    const allowed = new Set<SiteTheme>(['standard', 'christmas', 'halloween', 'black-friday', 'valentine'])
    const allowedDesigns = new Set<SiteDesignTheme>(['original', 'elegance'])
    const updates: string[] = []

    if (body.theme !== undefined) {
      const theme: SiteTheme = allowed.has(body.theme) ? body.theme : 'standard'
      await setSiteTheme(theme)
      revalidateTag('site-theme', { expire: 0 })
      updates.push(`temática: ${theme}`)
    }

    if (body.designTheme !== undefined) {
      const designTheme: SiteDesignTheme = allowedDesigns.has(body.designTheme) ? body.designTheme : 'original'
      await setSiteDesignTheme(designTheme)
      revalidateTag('site-design-theme', { expire: 0 })
      updates.push(`tema principal: ${designTheme}`)
    }

    if (updates.length === 0) return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 })
    await auditLog({ action: 'update', entity: 'theme', admin: admin.name, details: updates.join(', ') })
    const [theme, designTheme] = await Promise.all([getCachedSiteTheme(), getCachedSiteDesignTheme()])
    return NextResponse.json({ theme, designTheme })
  } catch (error) {
    console.error('POST /api/theme error:', error)
    return NextResponse.json({ error: 'No se pudo guardar el tema' }, { status: 500 })
  }
}
