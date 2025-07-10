import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            user: {
              email: session.user.email
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

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { participantEmails, isGroup, name } = await request.json()

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for existing 1:1 conversation
    if (!isGroup && participantEmails.length === 1) {
      // Find a conversation where isGroup is false and participants are exactly the two users
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          participants: {
            some: { userId: currentUser.id },
          },
          AND: [
            {
              participants: {
                some: { user: { email: participantEmails[0] } }
              }
            },
            {
              participants: {
                every: {
                  OR: [
                    { userId: currentUser.id },
                    { user: { email: participantEmails[0] } }
                  ]
                }
              }
            }
          ]
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
      if (existing) {
        return NextResponse.json(existing)
      }
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        isGroup,
        name: isGroup ? name : null,
        createdById: currentUser.id,
        participants: {
          create: [
            {
              user: { connect: { id: currentUser.id } },
              role: 'admin'
            },
            ...participantEmails.map((email: string) => ({
              user: { connect: { email } },
              role: 'member'
            }))
          ]
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

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 