// src/lib/auth.js - Updated with optimizations
import { createServerSupabase, createServiceSupabase } from './supabase'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

// Auth cache class for optimization
class AuthCache {
  constructor() {
    this.cache = new Map()
    this.authPromise = null
    this.lastAuthCheck = 0
    this.cacheDuration = 5 * 60 * 1000 // 5 minutes
  }

  // Get cached auth result if still valid
  getCached(key) {
    const now = Date.now()
    if (this.cache.has(key) && (now - this.lastAuthCheck) < this.cacheDuration) {
      return this.cache.get(key)
    }
    return null
  }

  // Set cache
  setCache(key, value) {
    this.cache.set(key, value)
    this.lastAuthCheck = Date.now()
  }

  // Clear cache
  clear() {
    this.cache.clear()
    this.authPromise = null
    this.lastAuthCheck = 0
  }
}

// Create singleton cache instance
const authCache = new AuthCache()

// Server-side function to get the current user (secure) - OPTIMIZED
export async function getUser() {
  const cacheKey = 'current_user'
  
  // Check cache first
  const cachedUser = authCache.getCached(cacheKey)
  if (cachedUser) {
    return cachedUser
  }

  // If there's already an auth check in progress, wait for it
  if (authCache.authPromise) {
    return authCache.authPromise
  }

  // Start new auth check
  authCache.authPromise = _performUserLookup()
  
  try {
    const user = await authCache.authPromise
    if (user) {
      authCache.setCache(cacheKey, user)
    }
    return user
  } catch (error) {
    authCache.clear()
    throw error
  } finally {
    authCache.authPromise = null
  }
}

// Internal function to actually perform the user lookup
async function _performUserLookup() {
  try {
    // Try using server Supabase first
    const supabase = await createServerSupabase()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (user && !error) {
      return user
    }

    // Fallback: check our custom cookies
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')
    
    if (accessToken) {
      const serviceSupabase = createServiceSupabase()
      const { data: { user: tokenUser }, error: tokenError } = await serviceSupabase.auth.getUser(accessToken.value)
      
      if (tokenUser && !tokenError) {
        return tokenUser
      }
    }
    
    return null
  } catch (error) {
    console.error('User lookup error:', error)
    return null
  }
}

// Server-side function to get the current session (use getUser instead for security)
// Deprecated - use getUser() instead
export async function getSession() {
  console.warn('getSession() is deprecated for security reasons. Use getUser() instead.')
  const user = await getUser()
  
  if (!user) return null
  
  // Return a session-like object for backward compatibility
  return {
    user,
    access_token: null, // We don't expose the token
    refresh_token: null
  }
}

// Server-side function to require authentication - OPTIMIZED
export async function requireAuth() {
  const cacheKey = 'require_auth'
  
  // Check cache first
  const cachedAuth = authCache.getCached(cacheKey)
  if (cachedAuth) {
    return cachedAuth
  }

  // Get user (this will use its own caching)
  const user = await getUser()
  
  if (!user) {
    // Clear cache on auth failure
    authCache.clear()
    redirect('/login')
  }
  
  // Create session-like object for backward compatibility
  const authResult = {
    user,
    access_token: null,
    refresh_token: null
  }

  // Cache the successful auth result
  authCache.setCache(cacheKey, authResult)
  
  return authResult
}

// Utility functions for cache management
export function clearAuthCache() {
  authCache.clear()
  console.log('Auth cache cleared')
}

export function preloadAuth() {
  // Pre-warm the auth cache (fire and forget)
  getUser().catch(error => {
    console.warn('Auth preload failed:', error.message)
  })
}

// Get cache statistics (for debugging)
export function getAuthCacheStats() {
  return {
    cacheSize: authCache.cache.size,
    lastCheck: authCache.lastAuthCheck,
    hasActivePromise: !!authCache.authPromise,
    cacheAge: Date.now() - authCache.lastAuthCheck
  }
}

// Optimized version of requireAuth that doesn't redirect (for API routes)
export async function requireAuthAPI() {
  const user = await getUser()
  
  if (!user) {
    authCache.clear()
    throw new Error('Authentication required')
  }
  
  return {
    user,
    access_token: null,
    refresh_token: null
  }
}

// Batch auth check for multiple operations (reduces redundant calls)
export async function batchAuthCheck(operations) {
  // Single auth check for multiple operations
  const auth = await requireAuth()
  
  // Execute all operations with the same auth context
  const results = await Promise.allSettled(
    operations.map(op => op(auth))
  )
  
  return results.map((result, index) => ({
    operation: index,
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }))
}

// Export the cache instance for advanced usage (if needed)
export { authCache }