// src/components/loginpage/LogoutButton.jsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton({ variant = 'default' }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/login')
        router.refresh()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {loading ? 'Signing out...' : 'Sign out'}
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}