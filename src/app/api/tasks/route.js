// src/app/api/tasks/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { TaskManagementService } from '@/lib/services/taskManagementService'

// GET - Fetch all tasks with filtering and pagination
export async function GET(request) {
  try {
    // Check authentication
    await requireAuth()

    const { searchParams } = new URL(request.url)
    
    const options = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      status: searchParams.get('status') || 'all',
      clientId: searchParams.get('clientId') || null,
      serviceId: searchParams.get('serviceId') || null,
      search: searchParams.get('search') || null,
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    // Validate pagination parameters
    if (options.page < 1) options.page = 1
    if (options.limit < 1 || options.limit > 100) options.limit = 10

    const result = await TaskManagementService.getAllTasks(options)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tasks: result.tasks,
      pagination: result.pagination,
      filters: {
        status: options.status,
        clientId: options.clientId,
        serviceId: options.serviceId,
        search: options.search
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

// POST - Create a new task
export async function POST(request) {
  try {
    // Check authentication
    await requireAuth()

    const taskData = await request.json()

    // Basic validation
    if (!taskData.client_id) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      )
    }

    if (!taskData.service_id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const result = await TaskManagementService.createTask(taskData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const response = {
      success: true,
      task: result.task
    }

    if (result.validation && result.validation.warnings) {
      response.warnings = result.validation.warnings
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}