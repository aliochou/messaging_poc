import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import sodium from 'libsodium-wrappers'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { encryptMedia, validateConversationAccess } from '@/lib/conversation-crypto'
import { withRateLimit, rateLimitConfigs } from '@/lib/rate-limit'
import { validateRequest, apiSchemas, sanitizeFilename } from '@/lib/validation'
import { withCSRFProtection } from '@/lib/csrf'
import { withSecurityMiddleware } from '@/lib/security-headers'
import { logMediaEvent, AuditEventType } from '@/lib/audit-log'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png'],
  video: ['video/mp4', 'video/avi', 'video/quicktime', 'video/mov'],
  pdf: ['application/pdf']
}

// Secure conversation key derivation replaces static key
async function encryptBuffer(buffer: Buffer, key: Buffer) {
  await sodium.ready
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(new Uint8Array(buffer), new Uint8Array(nonce), new Uint8Array(key))
  // Store as: nonce + ciphertext
  return Buffer.concat([Buffer.from(nonce), Buffer.from(ciphertext)])
}

async function transcodeTo720pMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Starting video transcoding:', { inputPath, outputPath })
    
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
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log('Transcoding progress:', progress)
      })
      .on('end', () => {
        console.log('Transcoding completed successfully')
        resolve()
      })
      .on('error', (err) => {
        console.error('Transcoding error:', err)
        reject(err)
      })
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
    console.log('Generating thumbnail from:', videoPath)
    console.log('Thumbnail will be saved to:', thumbPath)
    
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: path.basename(thumbPath),
        folder: path.dirname(videoPath),
        size: '200x?'
      })
      .on('start', (commandLine) => {
        console.log('FFmpeg thumbnail command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log('Thumbnail generation progress:', progress)
      })
      .on('end', async () => {
        try {
          console.log('Thumbnail generation completed, reading file...')
          const data = await fs.readFile(thumbPath)
          console.log('Thumbnail file size:', data.length)
          await fs.unlink(thumbPath)
          console.log('Thumbnail file cleaned up')
          resolve(data)
        } catch (e) { 
          console.error('Error reading thumbnail file:', e)
          reject(e) 
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg thumbnail error:', err)
        reject(err)
      })
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

const uploadHandler = withSecurityMiddleware(
  withCSRFProtection(
    withRateLimit(rateLimitConfigs.upload)(async (request: NextRequest) => {
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
    originalFilename,
    hasUploadedThumbnail: !!uploadedThumbnail,
    uploadedThumbnailSize: uploadedThumbnail?.size
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
  console.log('🔍 Checking conversation access:', { conversationId, userEmail: session.user.email })
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: true } } }
  })
  if (!conversation) {
    console.log('❌ Conversation not found:', conversationId)
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  console.log('✅ Conversation found:', { name: conversation.name, participants: conversation.participants.map(p => p.user.email) })
  const isParticipant = conversation.participants.some(p => p.user.email === session.user.email)
  console.log('🔐 Participant check:', { isParticipant, userEmail: session.user.email })
  if (!isParticipant) {
    console.log('❌ User not a participant:', { userEmail: session.user.email, conversationId })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ensure uploads dir exists
  await fs.mkdir(UPLOADS_DIR, { recursive: true })

  // Save file (with encryption)
  const ext = path.extname(originalFilename) || ''
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  let filePath = path.join(UPLOADS_DIR, `${id}${ext}`)
  let finalExt = ext // Track the final extension for videos
  let finalOriginalFilename = originalFilename // Track the final filename for videos
  const arrayBuffer = await file.arrayBuffer()
  let fileBuffer = Buffer.from(arrayBuffer)
  
  if (type === 'video') {
    // For videos: save uploaded file, transcode, then encrypt
    console.log('API upload: file buffer size', fileBuffer.length)
    // Save uploaded file temporarily
    const tempPath = path.join(UPLOADS_DIR, `${id}-temp${ext}`)
    await fs.writeFile(tempPath, fileBuffer)
    
    try {
      // Transcode video to MP4
      const transcodedPath = path.join(UPLOADS_DIR, `${id}-transcoded.mp4`)
      await transcodeTo720pMp4(tempPath, transcodedPath)
      
      // Generate thumbnail from transcoded (unencrypted) file
      console.log('Generating video thumbnail from transcoded file')
      let thumbBuffer: Buffer
      try {
        thumbBuffer = await generateVideoThumbnail(transcodedPath)
      } catch (error) {
        console.error('Thumbnail generation failed, creating placeholder:', error)
        // Create a video placeholder thumbnail
        thumbBuffer = await sharp({
          create: {
            width: 200,
            height: 150,
            channels: 3,
            background: { r: 50, g: 50, b: 50 }
          }
        }).jpeg().toBuffer()
      }
      const encryptedThumb = await encryptMedia(thumbBuffer, conversationId, session.user.email)
      const thumbPath = path.join(UPLOADS_DIR, `${id}-thumb.jpg`)
      await fs.writeFile(thumbPath, encryptedThumb)
      
      // Read transcoded file and encrypt
      const transcodedBuffer = await fs.readFile(transcodedPath)
      const encryptedBuffer = await encryptMedia(transcodedBuffer, conversationId, session.user.email)
      // Use .mp4 extension for transcoded videos
      finalExt = '.mp4'
      filePath = path.join(UPLOADS_DIR, `${id}${finalExt}`)
      await fs.writeFile(filePath, encryptedBuffer)
      // Update filename to reflect MP4 format
      const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '')
      finalOriginalFilename = `${nameWithoutExt}.mp4`
      // Clean up temp files
      await fs.unlink(tempPath)
      await fs.unlink(transcodedPath)
    } catch (error) {
      console.error('Video processing failed, using original file:', error)
      // Fallback: encrypt original file without transcoding
      const encryptedBuffer = await encryptMedia(fileBuffer, conversationId, session.user.email)
      await fs.writeFile(filePath, encryptedBuffer)
      
      // Create a simple placeholder thumbnail
      const placeholderThumb = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 3,
          background: { r: 100, g: 100, b: 100 }
        }
      }).jpeg().toBuffer()
      const encryptedThumb = await encryptMedia(placeholderThumb, conversationId, session.user.email)
      const thumbPath = path.join(UPLOADS_DIR, `${id}-thumb.jpg`)
      await fs.writeFile(thumbPath, encryptedThumb)
      
      // Clean up temp file
      await fs.unlink(tempPath)
    }
  } else {
    // For images and PDFs: encrypt and save
    console.log('API upload: encrypting and saving file for', type)
    const encryptedBuffer = await encryptMedia(fileBuffer, conversationId, session.user.email)
    await fs.writeFile(filePath, encryptedBuffer)
  }

  // Save or generate encrypted thumbnail for non-video files
  if (type !== 'video') {
    let thumbPath = path.join(UPLOADS_DIR, `${id}-thumb.jpg`)
    console.log('THUMBNAIL DEBUG:', { type, hasUploadedThumbnail: !!uploadedThumbnail })
    if (uploadedThumbnail) {
      // Encrypt and save uploaded thumbnail for images and PDFs
      console.log('Encrypting and saving uploaded thumbnail')
      const thumbArrayBuffer = await uploadedThumbnail.arrayBuffer()
      const thumbBuffer = Buffer.from(thumbArrayBuffer)
      const encryptedThumb = await encryptMedia(thumbBuffer, conversationId, session.user.email)
      await fs.writeFile(thumbPath, encryptedThumb)
    } else {
      // Fallback: use encrypted file as thumbnail (should not happen)
      console.log('Using fallback thumbnail (encrypted file)')
      await fs.writeFile(thumbPath, fileBuffer)
    }
  }

  // TODO: Transcode video, encrypt file and thumbnail, generate real thumbnail

  // Return file references
  // Save media message in DB
  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (currentUser) {
    await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUser.id,
        type: 'media',
        ciphertext: '',
        mediaUrl: `/uploads/${id}${finalExt}`,
        thumbnailUrl: `/uploads/${id}-thumb.jpg`,
        originalFilename: finalOriginalFilename
      }
    })
    // Optionally, update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })
  }

  // Log media upload event
  const securityContext = (request as any).securityContext
  await logMediaEvent(
    AuditEventType.MEDIA_UPLOADED,
    session.user.email,
    conversationId,
    finalOriginalFilename,
    file.size,
    securityContext?.ipAddress,
    securityContext?.userAgent
  )

  return NextResponse.json({
    mediaUrl: `/uploads/${id}${finalExt}`,
    thumbnailUrl: `/uploads/${id}-thumb.jpg`,
    originalFilename: finalOriginalFilename
  })
    })
  )
)

export const POST = uploadHandler 