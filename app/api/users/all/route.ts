import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        email: { not: session.user.email }
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true
      }
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching all users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 