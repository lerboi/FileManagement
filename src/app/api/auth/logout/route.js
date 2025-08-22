// src/app/api/auth/logout/route.js
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request) {
  try {
    // Clear the auth cookies
    const cookieStore = await cookies()
    
    cookieStore.delete('sb-access-token')
    cookieStore.delete('sb-refresh-token')

    return NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}