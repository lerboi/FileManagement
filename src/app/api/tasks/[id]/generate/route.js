// src/app/api/tasks/[id]/generate/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskWorkflowService } from '@/lib/services/taskWorkflowService'

// POST - Generate documents for a task (in_progress → awaiting)
export async function POST(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    console.log(`Starting document generation for task: ${id}`)

    const result = await TaskWorkflowService.startDocumentGeneration(id)

    if (!result.success) {
      // Check if it's a partial generation failure
      if (result.partialGeneration) {
        return NextResponse.json({
          success: false,
          error: result.error,
          task: result.task,
          partialGeneration: true,
          message: 'Task status updated but document generation failed'
        }, { status: 207 }) // 207 Multi-Status for partial success
      }

      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const response = {
      success: true,
      task: result.task,
      documentsGenerated: result.documentsGenerated,
      message: `Successfully generated ${result.documentsGenerated} documents`
    }

    if (result.warnings && result.warnings.length > 0) {
      response.warnings = result.warnings
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate documents' },
      { status: 500 }
    )
  }
}

// GET - Get generation status and preview
export async function GET(request, { params }) {
  try {
    // Check authentication
    await requireAuth()

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // This could be used to check generation status or get preview
    // For now, we'll return the current task state
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
    const generationStatus = {
      canGenerate: task.status === 'in_progress',
      isGenerating: task.status === 'awaiting' && !task.generation_completed_at,
      isCompleted: task.status === 'awaiting' && task.generation_completed_at,
      hasError: !!task.generation_error,
      error: task.generation_error,
      generatedDocuments: task.generated_documents || [],
      templateCount: task.template_ids?.length || 0
    }

    return NextResponse.json({
      success: true,
      taskId: id,
      generationStatus
    })
  } catch (error) {
    console.error('Error getting generation status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get generation status' },
      { status: 500 }
    )
  }
}