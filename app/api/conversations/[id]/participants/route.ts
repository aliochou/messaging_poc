import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { email } = await request.json()
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
    // Add participant
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    // Check if already a participant
    const already = conversation.participants.some(p => p.user.email === email)
    if (already) {
      return NextResponse.json({ error: 'Already a participant' }, { status: 400 })
    }
    await prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId: user.id,
        role: 'member',
      }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding participant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 