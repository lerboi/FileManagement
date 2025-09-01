// CREATE NEW FILE: src/app/api/tasks/[id]/draft/route.js
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { TaskManagementService } from '@/lib/services/taskManagementService'

// PUT - Update draft task
export async function PUT(request, { params }) {
  try {
    await requireSession()
    const { id } = await params
    const updates = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const result = await TaskManagementService.updateDraftTask(id, updates)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      message: 'Draft task updated successfully'
    })

  } catch (error) {
    console.error('Error updating draft task:', error)
    return NextResponse.json({ error: error.message || 'Failed to update draft task' }, { status: 500 })
  }
}

// POST - Finalize draft task (convert to in_progress and start document generation)
export async function POST(request, { params }) {
  try {
    await requireSession()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const result = await TaskManagementService.finalizeDraftTask(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      documentsGenerated: result.documentsGenerated || 0,
      message: result.documentsGenerated > 0 
        ? `Task finalized and ${result.documentsGenerated} documents generated successfully`
        : 'Task finalized successfully, but document generation failed'
    })

  } catch (error) {
    console.error('Error finalizing draft task:', error)
    return NextResponse.json({ error: error.message || 'Failed to finalize draft task' }, { status: 500 })
  }
}