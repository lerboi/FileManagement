// middleware.js (in root directory)
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  try {
    // Create a response object to pass to the middleware
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user (this will refresh the session if needed)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // Get the pathname
    const { pathname } = request.nextUrl

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/api/auth/callback', '/']
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))

    // If user is not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // If user is authenticated and trying to access login page
    if (user && pathname === '/login') {
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }

    return supabaseResponse
  } catch (error) {
    // Log the error for debugging
    console.error('Middleware error:', error)
    
    // Return a basic response to prevent the middleware from failing
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes) 
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}