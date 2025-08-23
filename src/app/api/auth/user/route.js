// src/app/api/auth/user/route.js
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Use service role to validate token without additional auth calls
    const supabase = createServiceSupabase()
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken.value)
      
      if (error || !user) {
        // Clear invalid cookies
        const response = NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        )
        response.cookies.delete('sb-access-token')
        response.cookies.delete('sb-refresh-token')
        return response
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email
        }
      })
    } catch (tokenError) {
      console.error('Token validation error:', tokenError)
      return NextResponse.json(
        { error: 'Token validation failed' },
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}