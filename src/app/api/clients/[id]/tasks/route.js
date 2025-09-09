// src/app/api/clients/[id]/tasks/route.js
import { NextResponse } from 'next/server'
import { TaskManagementService } from '@/lib/services/taskManagementService'
import { requireSession } from '@/lib/session'

// GET - Fetch all tasks for a specific client
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id: clientId } = await params

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const includeCompleted = searchParams.get('includeCompleted') === 'true'
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 50

    // Build status filter
    let statusFilter = 'all'
    if (status !== 'all') {
      statusFilter = status
    } else if (!includeCompleted) {
      statusFilter = 'in_progress,awaiting'
    }

    const result = await TaskManagementService.getAllTasks({
      clientId: clientId,
      status: statusFilter,
      page,
      limit,
      sortBy: 'created_at',
      sortOrder: 'desc'
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch tasks' },
        { status: 500 }
      )
    }

    // Separate ongoing and completed tasks
    const ongoingTasks = result.tasks.filter(task => 
      task.status === 'in_progress' || task.status === 'awaiting'
    )
    const completedTasks = result.tasks.filter(task => 
      task.status === 'completed'
    )

    return NextResponse.json({
      success: true,
      ongoingTasks,
      completedTasks,
      totalTasks: result.pagination.total,
      pagination: result.pagination
    }, { status: 200 })

  } catch (error) {
    console.error('Error fetching client tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch client tasks' },
      { status: 500 }
    )
  }
}