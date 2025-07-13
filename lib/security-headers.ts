import { NextRequest, NextResponse } from 'next/server'

// Security headers configuration
const SECURITY_HEADERS = {
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),

  // HTTP Strict Transport Security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // X-Frame-Options (deprecated but still useful for older browsers)
  'X-Frame-Options': 'DENY',

  // X-Content-Type-Options
  'X-Content-Type-Options': 'nosniff',

  // X-XSS-Protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '),

  // Cross-Origin Embedder Policy
  'Cross-Origin-Embedder-Policy': 'require-corp',

  // Cross-Origin Opener Policy
  'Cross-Origin-Opener-Policy': 'same-origin',

  // Cross-Origin Resource Policy
  'Cross-Origin-Resource-Policy': 'same-origin'
}

// Security headers middleware
export function withSecurityHeaders(handler: Function) {
  return async (request: NextRequest) => {
    const response = await handler(request)
    
    if (response instanceof NextResponse) {
      // Add security headers to the response
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        response.headers.set(header, value)
      })
    }
    
    return response
  }
}

// Apply security headers to all responses
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value)
  })
  return response
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.ip
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return remoteAddr || 'unknown'
}

// Get user agent
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

// Validate request origin
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // Allow requests without origin/referer (e.g., direct API calls)
  if (!origin && !referer) {
    return true
  }
  
  // In production, validate against allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://your-domain.com' // Replace with actual domain
  ]
  
  if (origin && allowedOrigins.includes(origin)) {
    return true
  }
  
  if (referer) {
    const refererUrl = new URL(referer)
    return allowedOrigins.some(allowed => {
      const allowedUrl = new URL(allowed)
      return refererUrl.origin === allowedUrl.origin
    })
  }
  
  return false
}

// Security middleware that combines all security features
export function withSecurityMiddleware(handler: Function) {
  return async (request: NextRequest) => {
    // Validate origin for non-GET requests
    if (request.method !== 'GET' && !validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }
    
    // Get security context
    const securityContext = {
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      timestamp: new Date().toISOString()
    }
    
    // Add security context to request
    ;(request as any).securityContext = securityContext
    
    // Call the original handler
    const response = await handler(request)
    
    // Apply security headers
    if (response instanceof NextResponse) {
      return applySecurityHeaders(response)
    }
    
    return response
  }
} 