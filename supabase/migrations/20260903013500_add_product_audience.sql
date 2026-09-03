ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "isForMen" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Product_isForMen_visible_idx"
  ON public."Product" ("isForMen", visible);
