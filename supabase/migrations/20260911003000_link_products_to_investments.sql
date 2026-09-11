BEGIN;

ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "investmentId" text;

CREATE INDEX IF NOT EXISTS "Product_investmentId_idx"
  ON public."Product" ("investmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_investmentId_fkey'
  ) THEN
    ALTER TABLE public."Product"
      ADD CONSTRAINT "Product_investmentId_fkey"
      FOREIGN KEY ("investmentId") REFERENCES public."Investment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
