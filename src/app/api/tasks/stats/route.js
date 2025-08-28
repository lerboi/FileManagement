// src/app/api/tasks/stats/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { TaskManagementService } from '@/lib/services/taskManagementService'

// GET - Get task statistics
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()

    console.log('Fetching task statistics...')

    const stats = await TaskManagementService.getTaskStatistics()

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching task statistics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task statistics' },
      { status: 500 }
    )
  }
}