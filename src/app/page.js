// src/app/page.js
import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const user = await getUser()
  
  // Redirect based on authentication status
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}