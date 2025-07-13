import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// Generate a cryptographically secure CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

// Validate CSRF token
export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) {
    return false
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(storedToken, 'hex')
  )
}

// CSRF middleware for API routes
export function withCSRFProtection(handler: Function) {
  return async (request: NextRequest) => {
    // Skip CSRF check for GET requests and OPTIONS (CORS preflight)
    if (request.method === 'GET' || request.method === 'OPTIONS') {
      return handler(request)
    }

    const csrfToken = request.headers.get('x-csrf-token')
    const session = await import('next-auth/next').then(m => m.getServerSession())
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get stored CSRF token from session or database
    const storedToken = await getStoredCSRFToken(session.user.email)
    
    if (!storedToken) {
      return NextResponse.json({ error: 'CSRF token not found' }, { status: 403 })
    }

    if (!validateCSRFToken(csrfToken || '', storedToken)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    return handler(request)
  }
}

// Store CSRF token (in production, use Redis or database)
async function getStoredCSRFToken(userEmail: string): Promise<string | null> {
  // For MVP, we'll use a simple in-memory store
  // In production, use Redis or database with proper expiration
  const { prisma } = await import('@/lib/prisma')
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { csrfToken: true, csrfTokenExpiry: true }
    })
    
    if (!user?.csrfToken) {
      return null
    }
    
    // Check if token has expired
    if (user.csrfTokenExpiry && new Date() > user.csrfTokenExpiry) {
      return null
    }
    
    return user.csrfToken
  } catch (error) {
    console.error('Error retrieving CSRF token:', error)
    return null
  }
}

// Store CSRF token for user
export async function storeCSRFToken(userEmail: string, token: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma')
  
  try {
    const expiry = new Date(Date.now() + CSRF_TOKEN_EXPIRY)
    
    await prisma.user.update({
      where: { email: userEmail },
      data: {
        csrfToken: token,
        csrfTokenExpiry: expiry
      }
    })
  } catch (error) {
    console.error('Error storing CSRF token:', error)
    throw error
  }
}

// Generate and store new CSRF token for user
export async function refreshCSRFToken(userEmail: string): Promise<string> {
  const token = generateCSRFToken()
  await storeCSRFToken(userEmail, token)
  return token
} 