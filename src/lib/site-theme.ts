import { db } from '@/lib/db'

export type SiteTheme = 'standard' | 'christmas'

export async function ensureSiteThemeTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SiteSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
    )
  `)
}

export async function getSiteTheme(): Promise<SiteTheme> {
  await ensureSiteThemeTable()
  const rows = await db.$queryRawUnsafe<Array<{ value: string }>>(
    'SELECT "value" FROM "SiteSetting" WHERE "key" = $1 LIMIT 1',
    'site-theme',
  )
  return rows[0]?.value === 'christmas' ? 'christmas' : 'standard'
}

export async function setSiteTheme(theme: SiteTheme) {
  await ensureSiteThemeTable()
  await db.$executeRawUnsafe(
    `INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    'site-theme',
    theme,
  )
}
