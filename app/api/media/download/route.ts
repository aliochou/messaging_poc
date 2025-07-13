import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import { decryptMedia, validateConversationAccess } from '@/lib/conversation-crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')
  const filename = searchParams.get('filename')

  if (!conversationId || !filename) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
  }

  // Validate user has access to conversation
  const hasAccess = await validateConversationAccess(conversationId, session.user.email)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Serve decrypted file
  const filePath = path.join(UPLOADS_DIR, filename)
  try {
    const encryptedFile = await fs.readFile(filePath)
    const decryptedFile = await decryptMedia(encryptedFile, conversationId, session.user.email)
    
    // Determine content type based on filename
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.mp4') contentType = 'video/mp4'
    else if (ext === '.pdf') contentType = 'application/pdf'
    
    return new NextResponse(decryptedFile, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (e) {
    console.error('Media download error:', e)
    return NextResponse.json({ error: 'File not found or decryption failed' }, { status: 404 })
  }
} 