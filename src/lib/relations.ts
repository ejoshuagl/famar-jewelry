import { db } from '@/lib/db'

let productRelationsReady: Promise<void> | null = null

async function createProductRelations() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductVariant" (
      "id" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "image" TEXT,
      "stock" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("productId", "id"),
      CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
    )
  `)
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId")')
  await db.$executeRawUnsafe(`
    INSERT INTO "ProductVariant" ("id", "productId", "name", "image", "stock", "updatedAt")
    SELECT variant->>'id', product."id", COALESCE(NULLIF(variant->>'name', ''), 'Variante'),
      NULLIF(variant->>'image', ''), GREATEST(0, COALESCE((variant->>'stock')::integer, 0)), CURRENT_TIMESTAMP
    FROM "Product" AS product
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN product."variants" IS NULL OR BTRIM(product."variants") = '' THEN '[]'::jsonb ELSE product."variants"::jsonb END
    ) AS variant
    WHERE NULLIF(variant->>'id', '') IS NOT NULL
    ON CONFLICT ("productId", "id") DO UPDATE SET
      "name" = EXCLUDED."name", "image" = EXCLUDED."image", "stock" = EXCLUDED."stock", "updatedAt" = CURRENT_TIMESTAMP
  `)
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_product_variants() RETURNS trigger AS $$
    BEGIN
      INSERT INTO "ProductVariant" ("id", "productId", "name", "image", "stock", "updatedAt")
      SELECT variant->>'id', NEW."id", COALESCE(NULLIF(variant->>'name', ''), 'Variante'),
        NULLIF(variant->>'image', ''), GREATEST(0, COALESCE((variant->>'stock')::integer, 0)), CURRENT_TIMESTAMP
      FROM jsonb_array_elements(
        CASE WHEN NEW."variants" IS NULL OR BTRIM(NEW."variants") = '' THEN '[]'::jsonb ELSE NEW."variants"::jsonb END
      ) AS variant
      WHERE NULLIF(variant->>'id', '') IS NOT NULL
      ON CONFLICT ("productId", "id") DO UPDATE SET
        "name" = EXCLUDED."name", "image" = EXCLUDED."image", "stock" = EXCLUDED."stock", "updatedAt" = CURRENT_TIMESTAMP;

      UPDATE "ProductVariant" SET "stock" = 0, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = NEW."id" AND "id" NOT IN (
        SELECT variant->>'id' FROM jsonb_array_elements(
          CASE WHEN NEW."variants" IS NULL OR BTRIM(NEW."variants") = '' THEN '[]'::jsonb ELSE NEW."variants"::jsonb END
        ) AS variant WHERE NULLIF(variant->>'id', '') IS NOT NULL
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "Product_sync_variants" ON "Product"')
  await db.$executeRawUnsafe(`
    CREATE TRIGGER "Product_sync_variants"
    AFTER INSERT OR UPDATE OF "variants" ON "Product"
    FOR EACH ROW EXECUTE FUNCTION sync_product_variants()
  `)
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productId_variantId_fkey') THEN
        ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_variantId_fkey"
        FOREIGN KEY ("productId", "variantId") REFERENCES "ProductVariant"("productId", "id") NOT VALID;
      END IF;
    END $$
  `)
}

export function ensureProductRelations() {
  productRelationsReady ||= createProductRelations().catch((error) => {
    productRelationsReady = null
    throw error
  })
  return productRelationsReady
}
