import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

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

  // Serve file
  const filePath = path.join(UPLOADS_DIR, filename)
  try {
    const file = await fs.readFile(filePath)
    // Set content type based on extension (encrypted, so use octet-stream)
    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
} 