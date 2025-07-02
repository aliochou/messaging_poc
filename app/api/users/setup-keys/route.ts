import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { publicKey, encryptedPrivateKey } = await request.json()

    // Update user with encryption keys
    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        publicKey,
        encryptedPrivateKey
      }
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Error setting up keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 