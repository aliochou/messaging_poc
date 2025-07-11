import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { name } = await request.json()
    const conversationId = params.id
    // Only allow if user is a participant
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
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { name },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating conversation name:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 