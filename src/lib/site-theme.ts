import { db } from '@/lib/db'
import { unstable_cache } from 'next/cache'

export type SiteTheme = 'standard' | 'christmas' | 'halloween' | 'black-friday' | 'valentine'
export type SiteDesignTheme = 'original' | 'elegance'

const SITE_THEMES = new Set<SiteTheme>(['standard', 'christmas', 'halloween', 'black-friday', 'valentine'])
const SITE_DESIGN_THEMES = new Set<SiteDesignTheme>(['original', 'elegance'])

export async function getSiteTheme(): Promise<SiteTheme> {
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>(
    'SELECT "value" FROM "SiteSetting" WHERE "key" = $1 LIMIT 1',
    'site-theme',
  )
  const value = rows[0]?.value as SiteTheme | undefined
  return value && SITE_THEMES.has(value) ? value : 'standard'
}

export const getCachedSiteTheme = unstable_cache(
  getSiteTheme,
  ['site-theme'],
  { tags: ['site-theme'], revalidate: 3600 },
)

export async function setSiteTheme(theme: SiteTheme) {
  await db.$executeRawUnsafe(
    `INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'site-theme',
    theme,
  )
}

export async function getSiteDesignTheme(): Promise<SiteDesignTheme> {
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>(
    'SELECT "value" FROM "SiteSetting" WHERE "key" = $1 LIMIT 1',
    'site-design-theme',
  )
  const value = rows[0]?.value as SiteDesignTheme | undefined
  return value && SITE_DESIGN_THEMES.has(value) ? value : 'original'
}

export const getCachedSiteDesignTheme = unstable_cache(
  getSiteDesignTheme,
  ['site-design-theme'],
  { tags: ['site-design-theme'], revalidate: 3600 },
)

export async function setSiteDesignTheme(theme: SiteDesignTheme) {
  await db.$executeRawUnsafe(
    `INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'site-design-theme',
    theme,
  )
}
