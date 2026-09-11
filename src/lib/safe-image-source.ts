import 'server-only'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTERNAL_HOSTS = new Set(['drive.google.com', 'lh3.googleusercontent.com'])

function allowedImageUrl(source: string) {
  let url: URL
  try { url = new URL(source) } catch { return null }
  if (url.protocol !== 'https:') return null
  let storageHost = ''
  try { storageHost = new URL(process.env.SUPABASE_URL || '').hostname } catch { storageHost = '' }
  if (url.hostname !== storageHost && !ALLOWED_EXTERNAL_HOSTS.has(url.hostname)) return null
  return url
}

export async function downloadTrustedImage(source: string, timeoutMs = 8_000) {
  const url = allowedImageUrl(source)
  if (!url) throw new Error('IMAGE_HOST_NOT_ALLOWED')
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
  if (!response.ok) throw new Error('IMAGE_DOWNLOAD_FAILED')
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || ''
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) throw new Error('IMAGE_TYPE_INVALID')
  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE')
  return buffer
}

export function decodeDataImage(source: string) {
  if (source.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 200) throw new Error('IMAGE_TOO_LARGE')
  const match = source.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=]+)$/i)
  if (!match) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE')
  return buffer
}
