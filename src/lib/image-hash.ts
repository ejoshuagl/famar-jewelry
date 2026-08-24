import 'server-only'

import sharp from 'sharp'

const HASH_SIZE = 8
const SAMPLE_SIZE = 32
const cosine = Array.from({ length: HASH_SIZE }, (_, frequency) =>
  Array.from(
    { length: SAMPLE_SIZE },
    (_, position) => Math.cos(((2 * position + 1) * frequency * Math.PI) / (2 * SAMPLE_SIZE))
  )
)

async function imageBuffer(source: string) {
  if (source.startsWith('data:')) {
    const comma = source.indexOf(',')
    if (comma < 0) throw new Error('Invalid image data')
    return Buffer.from(source.slice(comma + 1), 'base64')
  }

  const response = await fetch(source, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('Could not download image')
  return Buffer.from(await response.arrayBuffer())
}

export async function createPerceptualHash(source: string) {
  const input = await imageBuffer(source)
  const pixels = await sharp(input)
    .rotate()
    .grayscale()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer()

  const coefficients: number[] = []
  for (let vertical = 0; vertical < HASH_SIZE; vertical++) {
    for (let horizontal = 0; horizontal < HASH_SIZE; horizontal++) {
      let value = 0
      for (let y = 0; y < SAMPLE_SIZE; y++) {
        for (let x = 0; x < SAMPLE_SIZE; x++) {
          value +=
            pixels[y * SAMPLE_SIZE + x] *
            cosine[horizontal][x] *
            cosine[vertical][y]
        }
      }
      coefficients.push(value)
    }
  }

  const valuesWithoutDc = coefficients.slice(1).sort((a, b) => a - b)
  const median = valuesWithoutDc[Math.floor(valuesWithoutDc.length / 2)]
  let hash = 0n
  for (const coefficient of coefficients) {
    hash = (hash << 1n) | (coefficient >= median ? 1n : 0n)
  }
  return hash.toString(16).padStart(16, '0')
}

export function perceptualSimilarity(first: string, second: string) {
  let difference = BigInt(`0x${first}`) ^ BigInt(`0x${second}`)
  let changedBits = 0
  while (difference) {
    changedBits += Number(difference & 1n)
    difference >>= 1n
  }
  return 1 - changedBits / 64
}

export async function tryCreatePerceptualHash(source: string | null | undefined) {
  if (!source) return null
  try {
    return await createPerceptualHash(source)
  } catch (error) {
    console.error('Image hash error:', error)
    return null
  }
}
