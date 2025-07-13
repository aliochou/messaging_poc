import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export function useCSRF() {
  const { data: session } = useSession()
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch CSRF token
  const fetchCSRFToken = useCallback(async () => {
    if (!session?.user?.email) {
      setCsrfToken(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/csrf')
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token')
      }
      
      const data = await response.json()
      setCsrfToken(data.csrfToken)
    } catch (err) {
      console.error('Error fetching CSRF token:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch CSRF token')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.email])

  // Refresh CSRF token
  const refreshToken = useCallback(async () => {
    await fetchCSRFToken()
  }, [fetchCSRFToken])

  // Fetch token on session change
  useEffect(() => {
    fetchCSRFToken()
  }, [fetchCSRFToken])

  // Create headers with CSRF token
  const createHeaders = useCallback((additionalHeaders?: Record<string, string>) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }

    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }

    return headers
  }, [csrfToken])

  // Enhanced fetch with CSRF token
  const fetchWithCSRF = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers = createHeaders(options.headers as Record<string, string>)
    
    const response = await fetch(url, {
      ...options,
      headers
    })

    // If CSRF token is invalid, refresh it and retry once
    if (response.status === 403 && response.headers.get('x-csrf-invalid')) {
      await refreshToken()
      
      if (csrfToken) {
        const retryHeaders = createHeaders(options.headers as Record<string, string>)
        return fetch(url, {
          ...options,
          headers: retryHeaders
        })
      }
    }

    return response
  }, [csrfToken, createHeaders, refreshToken])

  return {
    csrfToken,
    loading,
    error,
    refreshToken,
    createHeaders,
    fetchWithCSRF
  }
} 