// src/lib/supabase.js - Updated with minor optimizations
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// For client-side usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For client components
export const createClientSupabase = () => createClientComponentClient()

// For server components - properly await cookies with error handling
export const createServerSupabase = async () => {
  try {
    const cookieStore = await cookies()
    return createServerComponentClient({ cookies: () => cookieStore })
  } catch (error) {
    console.error('Error creating server Supabase client:', error)
    // Fallback to basic client if cookies fail
    return createClient(supabaseUrl, supabaseAnonKey)
  }
}

// For API routes - use direct client with custom cookie handling
export const createRouteSupabase = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce'
    }
  })
}

// Service role client for admin operations (server-side only)
export const createServiceSupabase = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Service role client should only be used server-side')
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found, using anon key')
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Utility function to handle Supabase errors gracefully
export const handleSupabaseError = (error, context = '') => {
  console.error(`Supabase error ${context}:`, error)
  
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return {
      success: false,
      error: 'Request rate limit exceeded. Please try again in a moment.',
      retryable: true
    }
  }
  
  if (error.code === 'PGRST116') {
    return {
      success: false,
      error: 'No data found',
      retryable: false
    }
  }
  
  return {
    success: false,
    error: error.message || 'Database operation failed',
    retryable: false
  }
}