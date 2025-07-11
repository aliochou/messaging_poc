import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import sodium from 'libsodium-wrappers'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png'],
  video: ['video/mp4', 'video/avi', 'video/quicktime', 'video/mov'],
  pdf: ['application/pdf']
}

// Placeholder symmetric key (32 bytes for crypto_secretbox)
const SYMMETRIC_KEY = Buffer.from('0123456789abcdef0123456789abcdef', 'utf-8')

async function encryptBuffer(buffer: Buffer, key: Buffer) {
  await sodium.ready
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(new Uint8Array(buffer), new Uint8Array(nonce), new Uint8Array(key))
  // Store as: nonce + ciphertext
  return Buffer.concat([Buffer.from(nonce), Buffer.from(ciphertext)])
}

async function transcodeTo720pMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', 'scale=-2:720', // maintain aspect ratio, height=720
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

async function generateImageThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).resize(200, 200, { fit: 'inside' }).jpeg().toBuffer()
}

async function generateVideoThumbnail(videoPath: string): Promise<Buffer> {
  // Extract frame at 1s as JPEG
  const thumbPath = videoPath + '-thumb.jpg'
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: thumbPath,
        folder: path.dirname(videoPath),
        size: '200x?'
      })
      .on('end', async () => {
        try {
          const data = await fs.readFile(thumbPath)
          await fs.unlink(thumbPath)
          resolve(data)
        } catch (e) { reject(e) }
      })
      .on('error', reject)
  })
}

async function generatePdfThumbnail(buffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer)
  const page = pdfDoc.getPage(0)
  const { width, height } = page.getSize()
  // Render as PNG using pdf-lib is non-trivial; for MVP, return a blank JPEG
  // (In production, use pdfjs-dist + canvas or a service)
  return sharp({
    create: {
      width: 200,
      height: Math.round(200 * (height / width)),
      channels: 3,
      background: { r: 240, g: 240, b: 240 }
    }
  }).jpeg().toBuffer()
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    console.log('Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse multipart form data
  const formData = await request.formData()
  const conversationId = formData.get('conversationId') as string
  const type = formData.get('type') as string
  const file = formData.get('file') as File
  const originalFilename = formData.get('originalFilename') as string
  const uploadedThumbnail = formData.get('thumbnail') as File | null

  console.log('UPLOAD DEBUG:', {
    conversationId,
    type,
    file: file ? { name: file.name, type: file.type, size: file.size } : file,
    originalFilename
  })

  if (!conversationId || !type || !file || !originalFilename) {
    console.log('Missing required fields', { conversationId, type, file, originalFilename })
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate file type and size
  if (!ALLOWED_TYPES[type as keyof typeof ALLOWED_TYPES] || !ALLOWED_TYPES[type as keyof typeof ALLOWED_TYPES].includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  // Validate user is a participant
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: true } } }
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  const isParticipant = conversation.participants.some(p => p.user.email === session.user.email)
  if (!isParticipant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ensure uploads dir exists
  await fs.mkdir(UPLOADS_DIR, { recursive: true })

  // Save file (with encryption)
  const ext = path.extname(originalFilename) || ''
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  let filePath = path.join(UPLOADS_DIR, `${id}${ext}`)
  const arrayBuffer = await file.arrayBuffer()
  let fileBuffer = Buffer.from(arrayBuffer)

  // If video, transcode to 720p MP4
  if (type === 'video') {
    const tempPath = path.join(UPLOADS_DIR, `${id}-temp${ext}`)
    await fs.writeFile(tempPath, fileBuffer)
    const mp4Path = path.join(UPLOADS_DIR, `${id}.mp4`)
    await transcodeTo720pMp4(tempPath, mp4Path)
    await fs.unlink(tempPath)
    fileBuffer = await fs.readFile(mp4Path)
    await fs.unlink(mp4Path)
    filePath = path.join(UPLOADS_DIR, `${id}.mp4`)
  }

  // Save or generate encrypted thumbnail
  let thumbPath = path.join(UPLOADS_DIR, `${id}-thumb.jpg`)
  if (type === 'video') {
    // Generate thumbnail server-side for videos
    const thumbBuffer = await generateVideoThumbnail(filePath)
    const encryptedThumb = await encryptBuffer(thumbBuffer, SYMMETRIC_KEY)
    await fs.writeFile(thumbPath, encryptedThumb)
  } else if (uploadedThumbnail) {
    // Save uploaded encrypted thumbnail for images and PDFs
    const thumbArrayBuffer = await uploadedThumbnail.arrayBuffer()
    await fs.writeFile(thumbPath, Buffer.from(thumbArrayBuffer))
  } else {
    // Fallback: use encrypted file as thumbnail (should not happen)
    await fs.writeFile(thumbPath, fileBuffer)
  }

  // Encrypt file buffer
  const encryptedBuffer = await encryptBuffer(fileBuffer, SYMMETRIC_KEY)
  await fs.writeFile(filePath, encryptedBuffer)

  // TODO: Transcode video, encrypt file and thumbnail, generate real thumbnail

  // Return file references
  return NextResponse.json({
    mediaUrl: `/uploads/${id}${ext}`,
    thumbnailUrl: `/uploads/${id}-thumb.jpg`,
    originalFilename
  })
} 