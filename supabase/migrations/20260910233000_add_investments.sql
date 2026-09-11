BEGIN;

CREATE TABLE IF NOT EXISTS public."Investment" (
  "id" text PRIMARY KEY,
  "description" text NOT NULL,
  "merchandise" double precision NOT NULL,
  "taxes" double precision NOT NULL DEFAULT 0,
  "total" double precision NOT NULL,
  "purchasedAt" timestamp(3) NOT NULL,
  "notes" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Investment_merchandise_nonnegative" CHECK ("merchandise" >= 0),
  CONSTRAINT "Investment_taxes_nonnegative" CHECK ("taxes" >= 0),
  CONSTRAINT "Investment_total_nonnegative" CHECK ("total" >= 0)
);

CREATE INDEX IF NOT EXISTS "Investment_purchasedAt_idx"
  ON public."Investment" ("purchasedAt");

ALTER TABLE public."Investment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Investment" FROM anon, authenticated;

COMMIT;
