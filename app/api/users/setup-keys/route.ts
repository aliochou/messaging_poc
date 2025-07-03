import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  console.log("setup-keys API endpoint called");
  
  const session = await getServerSession()
  console.log("Session retrieved:", { hasSession: !!session, email: session?.user?.email });
  
  if (!session?.user?.email) {
    console.log("No session or email, returning 401");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log("Parsing request body...");
    const { publicKey, encryptedPrivateKey } = await request.json()
    console.log("Request body parsed successfully", { 
      hasPublicKey: !!publicKey, 
      hasEncryptedPrivateKey: !!encryptedPrivateKey 
    });

    // Update user with encryption keys
    console.log("Updating user in database...");
    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        publicKey,
        encryptedPrivateKey
      }
    })
    console.log("User updated successfully:", { userId: user.id, email: user.email });

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Error setting up keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 