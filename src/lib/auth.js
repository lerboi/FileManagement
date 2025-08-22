// src/lib/auth.js
import { createServerSupabase, createServiceSupabase } from './supabase'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

// Server-side function to get the current user (secure)
export async function getUser() {
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
    console.error('User error:', error)
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

// Server-side function to require authentication
export async function requireAuth() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // Return session-like object for backward compatibility
  return {
    user,
    access_token: null,
    refresh_token: null
  }
}