// CREATE NEW FILE: src/app/api/dashboard/stats/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    await requireSession()
    
    const supabase = await createServerSupabase()
    
    // Get all stats in parallel
    const [
      clientsResult,
      tasksResult,
      templatesResult,
      servicesResult
    ] = await Promise.all([
      // Total Clients count
      supabase
        .from('clients')
        .select('*', { count: 'exact', head: true }),
      
      // Active Tasks count (in_progress and awaiting)
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['in_progress', 'awaiting']),
      
      // Templates count
      supabase
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      // Active Services count
      supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
    ])

    // Check for any errors
    if (clientsResult.error) throw clientsResult.error
    if (tasksResult.error) throw tasksResult.error
    if (templatesResult.error) throw templatesResult.error
    if (servicesResult.error) throw servicesResult.error

    const stats = {
      totalClients: clientsResult.count || 0,
      activeTasks: tasksResult.count || 0,
      templates: templatesResult.count || 0,
      activeServices: servicesResult.count || 0
    }

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}