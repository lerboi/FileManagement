// src/lib/session.js
import { cookies } from 'next/headers'
import { createServerSupabase } from './supabase'

// Session cache to avoid repeated database calls
const sessionCache = new Map()
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export async function getSession() {
  try {
    const cookieStore = await cookies() // Await the cookies function
    
    // Get session cookies
    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value
    
    if (!accessToken) {
      return null
    }

    // Check cache first
    const cacheKey = accessToken.substring(0, 20) // Use part of token as cache key
    const cached = sessionCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.session
    }

    // Verify token with Supabase (only when cache misses)
    const supabase = await createServerSupabase()
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) {
      // Clear invalid session from cache
      sessionCache.delete(cacheKey)
      return null
    }

    const session = {
      user,
      accessToken,
      refreshToken,
      authenticated: true
    }

    // Cache the session
    sessionCache.set(cacheKey, {
      session,
      timestamp: Date.now()
    })

    return session
  } catch (error) {
    console.error('Session error:', error)
    return null
  }
}

export async function requireSession() {
  const session = await getSession()
  
  if (!session?.authenticated) {
    throw new Error('Authentication required')
  }
  
  return session
}

// Handle session refresh
export async function refreshSession() {
  try {
    const cookieStore = await cookies() // Await the cookies function
    const refreshToken = cookieStore.get('sb-refresh-token')?.value
    
    if (!refreshToken) {
      return null
    }

    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (error || !data.session) {
      return null
    }

    // Clear old cache entries
    clearSessionCache()

    return {
      user: data.user,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      authenticated: true
    }
  } catch (error) {
    console.error('Session refresh error:', error)
    return null
  }
}

// Clear session cache (call when user logs out)
export function clearSessionCache() {
  sessionCache.clear()
}