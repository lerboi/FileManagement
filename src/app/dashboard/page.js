// src/app/dashboard/page.js
import { requireSession } from '@/lib/session'
import DashboardContent from '@/components/dashboard/DashboardContent'

export const metadata = {
  title: 'Dashboard - Trust Distribution System',
  description: 'Admin dashboard for managing trust distributions',
}

// In your page component (e.g., app/page.js or app/dashboard/page.js)
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // This will redirect to login if not authenticated
  const session = await requireSession()

  return <DashboardContent user={session.user} />
}