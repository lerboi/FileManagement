// src/lib/session.js - Fixed version
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Session cache
const sessionCache = new Map()
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export async function getSession() {
  try {
    const cookieStore = await cookies()

    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value

    if (!accessToken) {
      return null
    }

    // Check cache first
    const cacheKey = accessToken.substring(0, 20)
    const cached = sessionCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.session
    }

    // Create Supabase client with the user's tokens
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })

    // Verify the token is valid
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      sessionCache.delete(cacheKey)
      return null
    }

    const session = {
      user,
      accessToken,
      refreshToken,
      authenticated: true
    }

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

// Create authenticated Supabase client from session
export async function createAuthenticatedSupabase() {
  const session = await getSession()

  if (!session?.authenticated) {
    throw new Error('Authentication required')
  }

  // Create client with user's access token
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    }
  })
}

export function clearSessionCache() {
  sessionCache.clear()
}