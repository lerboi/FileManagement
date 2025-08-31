// src/app/api/tasks/[id]/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskManagementService } from '@/lib/services/taskManagementService'
import { TaskWorkflowService } from '@/lib/services/taskWorkflowService'

// GET - Fetch a single task by ID
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

    const { searchParams } = new URL(request.url)
    const includeDocuments = searchParams.get('includeDocuments') !== 'false'

    const result = await TaskManagementService.getTaskById(id, includeDocuments)

    if (!result.success) {
      if (result.error === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Add workflow status information
    const workflowStatus = TaskWorkflowService.getTaskWorkflowStatus(result.task)
    const progress = TaskWorkflowService.getTaskProgress(result.task)

    return NextResponse.json({
      success: true,
      task: result.task,
      workflow: workflowStatus,
      progress: progress
    })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task' },
      { status: 500 }
    )
  }
}

// PUT - Update a task
export async function PUT(request, { params }) {
  try {
    // Check authentication
    await requireSession()

    const { id } = await params
    const updates = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const result = await TaskManagementService.updateTask(id, updates)

    if (!result.success) {
      if (result.error.includes('not found')) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      task: result.task
    })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a task - NEW METHOD
export async function DELETE(request, { params }) {
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

    console.log(`Starting deletion process for task: ${id}`)

    const result = await TaskManagementService.deleteTask(id)

    if (!result.success) {
      if (result.error === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Log file deletion results
    if (result.fileDeletionResults) {
      const fileResults = result.fileDeletionResults
      console.log('File deletion summary:', {
        generatedDocs: `${fileResults.generatedDocuments.success} deleted, ${fileResults.generatedDocuments.failed} failed`,
        signedDocs: `${fileResults.signedDocuments.success} deleted, ${fileResults.signedDocuments.failed} failed`,
        additionalFiles: `${fileResults.additionalFiles.success} deleted, ${fileResults.additionalFiles.failed} failed`
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Task and all related data deleted successfully',
      deletedTask: {
        id: result.deletedTask.id,
        clientName: result.deletedTask.client_name,
        serviceName: result.deletedTask.service_name
      },
      fileDeletionSummary: result.fileDeletionResults ? {
        totalFilesDeleted: (
          result.fileDeletionResults.generatedDocuments.success +
          result.fileDeletionResults.signedDocuments.success +
          result.fileDeletionResults.additionalFiles.success
        ),
        totalFilesFailed: (
          result.fileDeletionResults.generatedDocuments.failed +
          result.fileDeletionResults.signedDocuments.failed +
          result.fileDeletionResults.additionalFiles.failed
        )
      } : null
    })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    )
  }
}