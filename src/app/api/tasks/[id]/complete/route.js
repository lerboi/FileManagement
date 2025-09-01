// src/app/api/tasks/[id]/complete/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskWorkflowService } from '@/lib/services/taskWorkflowService'

// POST - Complete a task (awaiting → completed)
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { completionNotes = '', additionalData = {} } = body

    console.log(`Completing task: ${id}`)

    const completionData = {
      notes: completionNotes,
      ...additionalData
    }

    const result = await TaskWorkflowService.completeTask(id, completionData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const response = {
      success: true,
      task: result.task,
      message: 'Task completed successfully',
      completedAt: result.task.completed_at
    }

    // Add client update information
    if (result.clientUpdated) {
      response.clientUpdated = true
    }

    if (result.clientUpdateWarnings && result.clientUpdateWarnings.length > 0) {
      response.warnings = result.clientUpdateWarnings
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error completing task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete task' },
      { status: 500 }
    )
  }
}

// GET - Check if task can be completed
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const { TaskManagementService } = await import('@/lib/services/taskManagementService')
    
    const taskResult = await TaskManagementService.getTaskById(id)

    if (!taskResult.success) {
      if (taskResult.error === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: taskResult.error },
        { status: 500 }
      )
    }

    const task = taskResult.task
    const validation = await TaskWorkflowService.validateTaskCompletion(task)
    const workflowStatus = TaskWorkflowService.getTaskWorkflowStatus(task)

    const completionCheck = {
      canComplete: validation.valid,
      currentStatus: task.status,
      validationError: validation.error || null,
      missingSignedDocs: validation.missingSignedDocs || [],
      requirements: {
        hasGeneratedDocuments: (task.generated_documents || []).some(doc => doc.status === 'generated'),
        hasSignedDocuments: validation.signedDocumentCount > 0,
        isInAwaitingStatus: task.status === 'awaiting'
      },
      generatedDocuments: task.generated_documents || [],
      signedDocuments: task.signed_documents || [],
      workflowActions: workflowStatus.availableActions.filter(action => action.action === 'completeTask')
    }

    return NextResponse.json({
      success: true,
      taskId: id,
      completionCheck
    })
  } catch (error) {
    console.error('Error checking task completion status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check completion status' },
      { status: 500 }
    )
  }
}

// PUT - Update completion data (for already completed tasks)
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const { completionNotes, additionalData } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const { TaskManagementService } = await import('@/lib/services/taskManagementService')

    // First verify the task is completed
    const taskResult = await TaskManagementService.getTaskById(id)
    if (!taskResult.success) {
      return NextResponse.json(
        { error: taskResult.error },
        { status: 404 }
      )
    }

    if (taskResult.task.status !== 'completed') {
      return NextResponse.json(
        { error: 'Task must be completed to update completion data' },
        { status: 400 }
      )
    }

    // Update completion data
    const updateData = {}
    if (completionNotes !== undefined) {
      updateData.notes = completionNotes
    }
    if (additionalData) {
      // Merge with existing additional data if needed
      updateData.completion_data = {
        ...(taskResult.task.completion_data || {}),
        ...additionalData,
        lastUpdated: new Date().toISOString()
      }
    }

    const result = await TaskManagementService.updateTask(id, updateData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      message: 'Completion data updated successfully'
    })
  } catch (error) {
    console.error('Error updating completion data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update completion data' },
      { status: 500 }
    )
  }
}