// src/components/layout/ClientLayoutWrapper.jsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import DashboardLayout from './DashboardLayout'

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Pages that should NOT have the dashboard layout
  const publicPages = ['/login', '/']
  const isPublicPage = publicPages.includes(pathname)

  useEffect(() => {
    // Only check auth on protected pages to avoid rate limiting
    if (!isPublicPage) {
      checkAuth()
    } else {
      setLoading(false)
    }
  }, [pathname, isPublicPage])

  const checkAuth = async () => {
    try {
      // Use a simple client-side check first
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData.user)
      } else {
        // If not authenticated, redirect to login
        window.location.href = '/login'
        return
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      // On error, redirect to login
      window.location.href = '/login'
      return
    } finally {
      setLoading(false)
    }
  }

  // Show loading only for protected pages
  if (loading && !isPublicPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // For public pages or when user is not authenticated, render without dashboard layout
  if (isPublicPage || !user) {
    return children
  }

  return (
    <DashboardLayout user={user}>
      {children}
    </DashboardLayout>
  )
}