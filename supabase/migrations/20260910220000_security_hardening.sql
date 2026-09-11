BEGIN;

ALTER TABLE public."CouponRedemption"
  ADD COLUMN IF NOT EXISTS "claimedAt" timestamp(3);

UPDATE public."CouponRedemption" redemption
SET "claimedAt" = redemption."createdAt"
FROM public."Order" customer_order
WHERE customer_order.id = redemption."orderId"
  AND customer_order.status = 'confirmed'
  AND redemption."claimedAt" IS NULL;

UPDATE public."DiscountCoupon" coupon
SET "usageCount" = (
  SELECT COUNT(*)::integer
  FROM public."CouponRedemption" redemption
  WHERE redemption."couponId" = coupon.id
    AND redemption."claimedAt" IS NOT NULL
);

CREATE TABLE IF NOT EXISTS public."PublicRateLimit" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "windowStart" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PublicRateLimit_updatedAt_idx"
  ON public."PublicRateLimit" ("updatedAt");

ALTER TABLE public."PublicRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."PublicRateLimit" FROM anon, authenticated;

COMMIT;
