import type { Prisma } from '@prisma/client'

export function productCodePrefix(slug: string): string {
  return `FAM-${slug.substring(0, 2).toUpperCase()}`
}

export async function firstAvailableProductCode(
  tx: Prisma.TransactionClient,
  codePrefix: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ number: bigint }>>`
    SELECT SUBSTRING("code" FROM '[0-9]+$')::bigint AS number
    FROM "Product"
    WHERE "code" LIKE ${`${codePrefix}%`}
      AND "code" ~ ${`^${codePrefix}[0-9]+$`}
    ORDER BY number ASC
  `

  let available = 1
  for (const row of rows) {
    const used = Number(row.number)
    if (used < available) continue
    if (used === available) {
      available += 1
      continue
    }
    break
  }

  return `${codePrefix}${String(available).padStart(3, '0')}`
}
