import { createHash } from 'node:crypto'

const BUCKET = 'product-images'

type DataImage = {
  bytes: Uint8Array
  contentType: string
  extension: string
}

function storageConfig() {
  const url = process.env.SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) throw new Error('PRODUCT_STORAGE_NOT_CONFIGURED')
  return { url: url.replace(/\/$/, ''), secret }
}

function parseDataImage(source: string): DataImage | null {
  const match = source.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s)
  if (!match) return null
  const contentType = match[1]
  return {
    bytes: Buffer.from(match[2], 'base64'),
    contentType,
    extension: contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length),
  }
}

export async function persistProductImage(source: unknown, folder = 'products') {
  if (typeof source !== 'string' || !source) return ''
  const image = parseDataImage(source)
  if (!image) return source

  const { url, secret } = storageConfig()
  const hash = createHash('sha256').update(image.bytes).digest('hex')
  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, '-').toLowerCase()
  const objectPath = `${safeFolder}/${hash}.${image.extension}`
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      'content-type': image.contentType,
      'cache-control': '31536000',
      'x-upsert': 'true',
    },
    body: image.bytes,
  })
  if (!response.ok) {
    console.error('Supabase image upload failed:', response.status, await response.text())
    throw new Error('PRODUCT_IMAGE_UPLOAD_FAILED')
  }
  return `${url}/storage/v1/object/public/${BUCKET}/${objectPath}`
}

export async function persistProductGallery(images: unknown, folder?: string) {
  if (!Array.isArray(images)) return []
  return Promise.all(images.map((image) => persistProductImage(image, folder)))
}

export async function persistVariantImages<T extends { image?: string | null }>(variants: T[], folder?: string) {
  return Promise.all(variants.map(async (variant) => ({
    ...variant,
    image: variant.image ? await persistProductImage(variant.image, folder) : variant.image,
  })))
}
