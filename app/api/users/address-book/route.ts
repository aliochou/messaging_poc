import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all 1:1 conversations for the current user
    const conversations = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: {
          some: {
            user: { email: session.user.email }
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
        }
      }
    })

    // Collect unique users (excluding self)
    const usersMap: Record<string, any> = {}
    conversations.forEach(conv => {
      conv.participants.forEach(p => {
        if (p.user.email !== session.user.email) {
          usersMap[p.user.email] = p.user
        }
      })
    })
    const users = Object.values(usersMap)

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching address book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 