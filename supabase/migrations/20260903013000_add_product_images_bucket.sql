INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public."ProductImageMigrationBackup" (
  "productId" text PRIMARY KEY REFERENCES public."Product"(id) ON DELETE CASCADE,
  "mainImage" text,
  images text,
  variants text,
  "migratedAt" timestamptz NOT NULL DEFAULT now()
);
