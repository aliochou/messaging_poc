import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Skip rate limiting for successful requests
  skipFailedRequests?: boolean // Skip rate limiting for failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store (in production, use Redis or similar)
const store: RateLimitStore = {}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime <= now) {
      delete store[key]
    }
  })
}, 60000) // Clean up every minute

export function createRateLimit(config: RateLimitConfig) {
  return function rateLimit(req: NextRequest): NextResponse | null {
    const key = config.keyGenerator ? config.keyGenerator(req) : getClientIP(req)
    const now = Date.now()
    
    // Get or create rate limit entry
    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      }
    }
    
    const entry = store[key]
    
    // Reset if window has expired
    if (now > entry.resetTime) {
      entry.count = 0
      entry.resetTime = now + config.windowMs
    }
    
    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString()
          }
        }
      )
    }
    
    // Increment counter
    entry.count++
    
    // Add rate limit headers to response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', (config.maxRequests - entry.count).toString())
    response.headers.set('X-RateLimit-Reset', entry.resetTime.toString())
    
    return null // Continue to next middleware/handler
  }
}

function getClientIP(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to connection remote address
  return req.ip || 'unknown'
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    keyGenerator: (req: NextRequest) => `auth:${getClientIP(req)}`
  },
  
  // Moderate rate limiting for API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    keyGenerator: (req: NextRequest) => `api:${getClientIP(req)}`
  },
  
  // Strict rate limiting for file uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 uploads per hour
    keyGenerator: (req: NextRequest) => `upload:${getClientIP(req)}`
  },
  
  // Very strict rate limiting for key setup
  keySetup: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    keyGenerator: (req: NextRequest) => `keysetup:${getClientIP(req)}`
  }
}

// Helper function to apply rate limiting to API routes
export function withRateLimit(config: RateLimitConfig) {
  const rateLimiter = createRateLimit(config)
  
  return function(handler: (req: NextRequest) => Promise<NextResponse>) {
    return async function(req: NextRequest): Promise<NextResponse> {
      const rateLimitResult = rateLimiter(req)
      if (rateLimitResult) {
        return rateLimitResult
      }
      
      return handler(req)
    }
  }
} 