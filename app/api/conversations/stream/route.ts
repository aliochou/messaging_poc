import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userEmail = session.user.email

  // Set up SSE headers
  const encoder = new TextEncoder()
  let closed = false
  let interval: NodeJS.Timeout | null = null
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      if (!closed) controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      // Polling function: always send full conversation list
      const pollForConversations = async () => {
        if (closed) return
        try {
          const conversations = await prisma.conversation.findMany({
            where: {
              participants: {
                some: {
                  user: {
                    email: userEmail
                  }
                }
              }
            },
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      image: true
                    }
                  }
                }
              },
              messages: {
                orderBy: {
                  createdAt: 'desc'
                },
                take: 1
              }
            },
            orderBy: {
              updatedAt: 'desc'
            }
          })

          // Always send the full list
          if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversations', data: conversations })}\n\n`))
        } catch (error) {
          if (!closed) {
            console.error('Error polling for conversations:', error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch conversations' })}\n\n`))
          }
        }
      }

      interval = setInterval(pollForConversations, 3000)
      pollForConversations()
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