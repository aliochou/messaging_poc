import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { refreshCSRFToken } from '@/lib/csrf'
import { withSecurityMiddleware } from '@/lib/security-headers'
import { logSecurityEvent, AuditEventType } from '@/lib/audit-log'

const csrfHandler = withSecurityMiddleware(async (request: NextRequest) => {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Generate new CSRF token
    const token = await refreshCSRFToken(session.user.email)
    
    // Log CSRF token generation
    const securityContext = (request as any).securityContext
    await logSecurityEvent(
      AuditEventType.CSRF_TOKEN_GENERATED,
      session.user.email,
      securityContext?.ipAddress,
      securityContext?.userAgent,
      { timestamp: new Date().toISOString() }
    )

    return NextResponse.json({ csrfToken: token })
  } catch (error) {
    console.error('Error generating CSRF token:', error)
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 })
  }
})

export const GET = csrfHandler 