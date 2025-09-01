// CREATE NEW FILE: src/app/api/tasks/draft/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskManagementService } from '@/lib/services/taskManagementService'

// POST - Create a new draft task
export async function POST(request) {
  try {
    await requireSession()

    const { client_id, service_id } = await request.json()

    if (!client_id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    if (!service_id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    const draftData = {
      client_id,
      service_id,
      custom_field_values: {},
      notes: '',
      priority: 'normal',
      assigned_to: null
    }

    const result = await TaskManagementService.createDraftTask(draftData)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      message: 'Draft task created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating draft task:', error)
    return NextResponse.json({ error: error.message || 'Failed to create draft task' }, { status: 500 })
  }
}

// GET - Get all draft tasks for current user
export async function GET(request) {
  try {
    await requireSession()

    const result = await TaskManagementService.getDraftTasks()

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      drafts: result.drafts
    })

  } catch (error) {
    console.error('Error fetching draft tasks:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch draft tasks' }, { status: 500 })
  }
}