// src/app/dashboard/page.js
import { requireAuth } from '@/lib/auth'
import DashboardContent from '@/components/dashboard/DashboardContent'

export const metadata = {
  title: 'Dashboard - Trust Distribution System',
  description: 'Admin dashboard for managing trust distributions',
}

export default async function DashboardPage() {
  // This will redirect to login if not authenticated
  const session = await requireAuth()

  return <DashboardContent user={session.user} />
}