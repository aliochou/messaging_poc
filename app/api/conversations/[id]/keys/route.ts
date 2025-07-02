import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { encryptedSymmetricKey } = await request.json()
    const conversationId = params.id

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create or update conversation key
    const conversationKey = await prisma.conversationKey.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id
        }
      },
      update: {
        encryptedSymmetricKey
      },
      create: {
        conversationId,
        userId: currentUser.id,
        encryptedSymmetricKey
      }
    })

    return NextResponse.json(conversationKey)
  } catch (error) {
    console.error('Error setting conversation key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const conversationId = params.id

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get conversation key
    const conversationKey = await prisma.conversationKey.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id
        }
      }
    })

    if (!conversationKey) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    return NextResponse.json(conversationKey)
  } catch (error) {
    console.error('Error getting conversation key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 