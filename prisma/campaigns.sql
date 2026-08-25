CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "image" TEXT,
  "placement" TEXT NOT NULL DEFAULT 'popup',
  "ctaLabel" TEXT,
  "ctaView" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_active_startAt_endAt_idx"
  ON "Campaign"("active", "startAt", "endAt");
