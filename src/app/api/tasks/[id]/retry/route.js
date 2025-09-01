// src/app/api/tasks/[id]/retry/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskWorkflowService } from '@/lib/services/taskWorkflowService'

// POST - Retry failed document generation
export async function POST(request, { params }) {
  try {s
    // Check authentication
    await requireSession()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    console.log(`Retrying document generation for task: ${id}`)

    const result = await TaskWorkflowService.retryDocumentGeneration(id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const response = {
      success: true,
      task: result.task,
      message: 'Document generation retry initiated successfully'
    }

    if (result.documentsGenerated !== undefined) {
      response.documentsGenerated = result.documentsGenerated
      response.message = `Document generation retry completed. Generated ${result.documentsGenerated} documents`
    }

    if (result.warnings && result.warnings.length > 0) {
      response.warnings = result.warnings
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error retrying document generation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retry document generation' },
      { status: 500 }
    )
  }
}

// GET - Check retry eligibility
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
    
    const result = await TaskManagementService.getTaskById(id)

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

    const task = result.task
    const canRetry = task.status === 'awaiting' && task.generation_error
    
    const retryInfo = {
      canRetry,
      currentStatus: task.status,
      hasGenerationError: !!task.generation_error,
      generationError: task.generation_error,
      lastAttempt: task.generation_completed_at,
      generatedDocuments: task.generated_documents?.length || 0,
      expectedDocuments: task.template_ids?.length || 0
    }

    return NextResponse.json({
      success: true,
      taskId: id,
      retryInfo
    })
  } catch (error) {
    console.error('Error checking retry eligibility:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check retry eligibility' },
      { status: 500 }
    )
  }
}