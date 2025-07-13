import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
  }

  // Verify user is part of conversation
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      userId_conversationId: {
        userId: (await prisma.user.findUnique({ where: { email: session.user.email } }))!.id,
        conversationId
      }
    }
  })

  if (!participant) {
    return NextResponse.json({ error: 'Not part of conversation' }, { status: 403 })
  }

  // Set up SSE headers
  const encoder = new TextEncoder()
  let closed = false
  let interval: NodeJS.Timeout | null = null
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      if (!closed) controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      // Set up polling for new messages
      let lastMessageId: string | null = null
      
      const pollForMessages = async () => {
        if (closed) return
        try {
          const messages = await prisma.message.findMany({
            where: {
              conversationId,
              ...(lastMessageId ? { id: { gt: lastMessageId } } : {})
            },
            select: {
              id: true,
              conversationId: true,
              senderId: true,
              type: true,
              ciphertext: true,
              mediaUrl: true,
              thumbnailUrl: true,
              originalFilename: true,
              status: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          if (messages.length > 0) {
            lastMessageId = messages[messages.length - 1].id
            for (const message of messages) {
              if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`))
            }
          }
        } catch (error) {
          if (!closed) {
            console.error('Error polling for messages:', error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch messages' })}\n\n`))
          }
        }
      }

      interval = setInterval(pollForMessages, 2000)
      pollForMessages()
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
} 