import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const MAX_SIZE_BYTES = 8 * 1024 * 1024
const BUCKET = 'product-images'

async function uploadToSupabase(buffer: Buffer, filename: string, contentType: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const objectPath = `products/${filename}`

  const upload = async () =>
    supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType,
      upsert: false,
    })

  let { error } = await upload()

  if (error?.message?.toLowerCase().includes('bucket not found')) {
    await supabase.storage.createBucket(BUCKET, { public: true })
    ;({ error } = await upload())
  }

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

async function uploadToLocal(buffer: Buffer, filename: string) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)
  return `/uploads/products/${filename}`
}

export async function POST(request: NextRequest) {
  try {
    const adminName = request.headers.get('x-admin-name')
    if (!adminName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa JPG, PNG, WEBP o GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'La imagen no puede superar 8 MB.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`

    const supabaseUrl = await uploadToSupabase(buffer, filename, file.type)
    if (supabaseUrl) {
      return NextResponse.json({ url: supabaseUrl })
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            'Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel para guardar las fotos.',
        },
        { status: 500 }
      )
    }

    const localUrl = await uploadToLocal(buffer, filename)
    return NextResponse.json({ url: localUrl })
  } catch (error) {
    console.error('POST /api/uploads error:', error)
    const message = error instanceof Error ? error.message : 'Error al subir la imagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
